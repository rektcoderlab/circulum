use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod circulum {
    use super::*;

    /// Initialize a new subscription plan
    pub fn create_subscription_plan(
        ctx: Context<CreateSubscriptionPlan>,
        plan_id: u64,
        price: u64,
        interval_seconds: i64,
        max_subscribers: u32,
        metadata_uri: String,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let creator = &ctx.accounts.creator;

        subscription_plan.creator = creator.key();
        subscription_plan.plan_id = plan_id;
        subscription_plan.price = price;
        subscription_plan.interval_seconds = interval_seconds;
        subscription_plan.max_subscribers = max_subscribers;
        subscription_plan.current_subscribers = 0;
        subscription_plan.is_active = true;
        subscription_plan.metadata_uri = metadata_uri;
        subscription_plan.created_at = Clock::get()?.unix_timestamp;

        emit!(SubscriptionPlanCreated {
            creator: creator.key(),
            plan_id,
            price,
            interval_seconds,
        });

        Ok(())
    }

    /// Subscribe to a plan
    pub fn subscribe(
        ctx: Context<Subscribe>,
        plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let subscription = &mut ctx.accounts.subscription;
        let subscriber = &ctx.accounts.subscriber;

        // Check if plan is active and has capacity
        require!(subscription_plan.is_active, ErrorCode::PlanInactive);
        require!(
            subscription_plan.current_subscribers < subscription_plan.max_subscribers,
            ErrorCode::PlanFull
        );

        // Initialize subscription
        subscription.subscriber = subscriber.key();
        subscription.plan_id = plan_id;
        subscription.creator = subscription_plan.creator;
        subscription.is_active = true;
        subscription.last_payment = Clock::get()?.unix_timestamp;
        subscription.next_payment = Clock::get()?.unix_timestamp + subscription_plan.interval_seconds;
        subscription.total_payments = 0;

        // Update plan subscriber count
        subscription_plan.current_subscribers += 1;

        emit!(SubscriptionCreated {
            subscriber: subscriber.key(),
            creator: subscription_plan.creator,
            plan_id,
        });

        Ok(())
    }

    /// Process recurring payment
    pub fn process_payment(
        ctx: Context<ProcessPayment>,
        plan_id: u64,
    ) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription;
        let subscription_plan = &ctx.accounts.subscription_plan;
        let clock = Clock::get()?;

        // Verify payment is due
        require!(
            clock.unix_timestamp >= subscription.next_payment,
            ErrorCode::PaymentNotDue
        );
        require!(subscription.is_active, ErrorCode::SubscriptionInactive);

        // Transfer payment from subscriber to creator
        let cpi_accounts = Transfer {
            from: ctx.accounts.subscriber_token_account.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.subscriber.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, subscription_plan.price)?;

        // Update subscription
        subscription.last_payment = clock.unix_timestamp;
        subscription.next_payment = clock.unix_timestamp + subscription_plan.interval_seconds;
        subscription.total_payments += 1;

        emit!(PaymentProcessed {
            subscriber: subscription.subscriber,
            creator: subscription.creator,
            plan_id,
            amount: subscription_plan.price,
            payment_number: subscription.total_payments,
        });

        Ok(())
    }

    /// Cancel subscription
    pub fn cancel_subscription(
        ctx: Context<CancelSubscription>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription;
        let subscription_plan = &mut ctx.accounts.subscription_plan;

        require!(subscription.is_active, ErrorCode::SubscriptionInactive);

        subscription.is_active = false;
        subscription_plan.current_subscribers -= 1;

        emit!(SubscriptionCancelled {
            subscriber: subscription.subscriber,
            creator: subscription.creator,
            plan_id: subscription.plan_id,
        });

        Ok(())
    }

    /// Update subscription plan (creator only)
    pub fn update_subscription_plan(
        ctx: Context<UpdateSubscriptionPlan>,
        plan_id: u64,
        new_price: Option<u64>,
        new_interval: Option<i64>,
        new_max_subscribers: Option<u32>,
        new_metadata_uri: Option<String>,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;

        if let Some(price) = new_price {
            subscription_plan.price = price;
        }
        if let Some(interval) = new_interval {
            subscription_plan.interval_seconds = interval;
        }
        if let Some(max_subs) = new_max_subscribers {
            subscription_plan.max_subscribers = max_subs;
        }
        if let Some(metadata) = new_metadata_uri {
            subscription_plan.metadata_uri = metadata;
        }

        emit!(SubscriptionPlanUpdated {
            creator: subscription_plan.creator,
            plan_id,
        });

        Ok(())
    }

    /// Deactivate subscription plan
    pub fn deactivate_plan(
        ctx: Context<DeactivatePlan>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        subscription_plan.is_active = false;

        emit!(SubscriptionPlanDeactivated {
            creator: subscription_plan.creator,
            plan_id: subscription_plan.plan_id,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct CreateSubscriptionPlan<'info> {
    #[account(
        init,
        payer = creator,
        space = SubscriptionPlan::LEN,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct Subscribe<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", subscription_plan.creator.as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(
        init,
        payer = subscriber,
        space = Subscription::LEN,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    #[account(mut)]
    pub subscriber: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct ProcessPayment<'info> {
    #[account(
        seeds = [b"subscription_plan", subscription_plan.creator.as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(mut)]
    pub subscriber_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct CancelSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", subscription_plan.creator.as_ref(), &plan_id.to_le_bytes()],
        bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump,
        has_one = subscriber
    )]
    pub subscription: Account<'info, Subscription>,
    pub subscriber: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct UpdateSubscriptionPlan<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump,
        has_one = creator
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct DeactivatePlan<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump,
        has_one = creator
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    pub creator: Signer<'info>,
}

#[account]
pub struct SubscriptionPlan {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub price: u64,
    pub interval_seconds: i64,
    pub max_subscribers: u32,
    pub current_subscribers: u32,
    pub is_active: bool,
    pub metadata_uri: String,
    pub created_at: i64,
}

impl SubscriptionPlan {
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        8 + // plan_id
        8 + // price
        8 + // interval_seconds
        4 + // max_subscribers
        4 + // current_subscribers
        1 + // is_active
        4 + 200 + // metadata_uri (String with max 200 chars)
        8; // created_at
}

#[account]
pub struct Subscription {
    pub subscriber: Pubkey,
    pub plan_id: u64,
    pub creator: Pubkey,
    pub is_active: bool,
    pub last_payment: i64,
    pub next_payment: i64,
    pub total_payments: u64,
}

impl Subscription {
    pub const LEN: usize = 8 + // discriminator
        32 + // subscriber
        8 + // plan_id
        32 + // creator
        1 + // is_active
        8 + // last_payment
        8 + // next_payment
        8; // total_payments
}

#[event]
pub struct SubscriptionPlanCreated {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub price: u64,
    pub interval_seconds: i64,
}

#[event]
pub struct SubscriptionCreated {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
}

#[event]
pub struct PaymentProcessed {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
    pub amount: u64,
    pub payment_number: u64,
}

#[event]
pub struct SubscriptionCancelled {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
}

#[event]
pub struct SubscriptionPlanUpdated {
    pub creator: Pubkey,
    pub plan_id: u64,
}

#[event]
pub struct SubscriptionPlanDeactivated {
    pub creator: Pubkey,
    pub plan_id: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Subscription plan is inactive")]
    PlanInactive,
    #[msg("Subscription plan is full")]
    PlanFull,
    #[msg("Payment is not due yet")]
    PaymentNotDue,
    #[msg("Subscription is inactive")]
    SubscriptionInactive,
}
