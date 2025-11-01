use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod circulum {
    use super::*;

    /// Initialize a new subscription plan
    /// 
    /// # Arguments
    /// * `plan_id` - Unique identifier for the plan
    /// * `price` - Price per billing cycle in smallest token unit
    /// * `interval_seconds` - Billing interval in seconds (minimum 60)
    /// * `max_subscribers` - Maximum number of allowed subscribers
    /// * `metadata_uri` - URI pointing to plan metadata (max 200 chars)
    pub fn create_subscription_plan(
        ctx: Context<CreateSubscriptionPlan>,
        plan_id: u64,
        price: u64,
        interval_seconds: i64,
        max_subscribers: u32,
        metadata_uri: String,
    ) -> Result<()> {
        // Validate inputs
        require!(price > 0, ErrorCode::InvalidPrice);
        require!(interval_seconds >= 60, ErrorCode::IntervalTooShort);
        require!(max_subscribers > 0, ErrorCode::InvalidMaxSubscribers);
        require!(metadata_uri.len() <= 200, ErrorCode::MetadataUriTooLong);

        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let creator = &ctx.accounts.creator;
        let clock = Clock::get()?;

        subscription_plan.creator = creator.key();
        subscription_plan.plan_id = plan_id;
        subscription_plan.price = price;
        subscription_plan.interval_seconds = interval_seconds;
        subscription_plan.max_subscribers = max_subscribers;
        subscription_plan.current_subscribers = 0;
        subscription_plan.is_active = true;
        subscription_plan.is_paused = false;
        subscription_plan.metadata_uri = metadata_uri;
        subscription_plan.created_at = clock.unix_timestamp;
        subscription_plan.bump = ctx.bumps.subscription_plan;

        emit!(SubscriptionPlanCreated {
            creator: creator.key(),
            plan_id,
            price,
            interval_seconds,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Subscribe to a plan and make initial payment
    /// 
    /// # Security
    /// - Validates token accounts belong to correct owners
    /// - Collects first payment immediately
    /// - Verifies plan capacity and active status
    pub fn subscribe(
        ctx: Context<Subscribe>,
        plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let subscription = &mut ctx.accounts.subscription;
        let subscriber = &ctx.accounts.subscriber;
        let clock = Clock::get()?;

        // Check if plan is active, not paused, and has capacity
        require!(subscription_plan.is_active, ErrorCode::PlanInactive);
        require!(!subscription_plan.is_paused, ErrorCode::PlanPaused);
        require!(
            subscription_plan.current_subscribers < subscription_plan.max_subscribers,
            ErrorCode::PlanFull
        );

        // Process initial payment
        let cpi_accounts = Transfer {
            from: ctx.accounts.subscriber_token_account.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.subscriber.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, subscription_plan.price)?;

        // Initialize subscription
        subscription.subscriber = subscriber.key();
        subscription.plan_id = plan_id;
        subscription.creator = subscription_plan.creator;
        subscription.is_active = true;
        subscription.last_payment = clock.unix_timestamp;
        subscription.next_payment = clock.unix_timestamp
            .checked_add(subscription_plan.interval_seconds)
            .ok_or(ErrorCode::Overflow)?;
        subscription.total_payments = 1; // Initial payment counts
        subscription.bump = ctx.bumps.subscription;

        // Update plan subscriber count with overflow check
        subscription_plan.current_subscribers = subscription_plan.current_subscribers
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(SubscriptionCreated {
            subscriber: subscriber.key(),
            creator: subscription_plan.creator,
            plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Process recurring payment for an active subscription
    /// 
    /// # Security
    /// - Validates payment is due within acceptable window
    /// - Verifies token account ownership and mint
    /// - Checks subscription and plan are active
    pub fn process_payment(
        ctx: Context<ProcessPayment>,
        plan_id: u64,
    ) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription;
        let subscription_plan = &ctx.accounts.subscription_plan;
        let clock = Clock::get()?;

        // Verify payment is due (with 7-day grace period)
        require!(
            clock.unix_timestamp >= subscription.next_payment,
            ErrorCode::PaymentNotDue
        );
        
        // Verify payment isn't too late (no more than 7 days past due)
        let max_payment_time = subscription.next_payment
            .checked_add(7 * 24 * 60 * 60) // 7 days
            .ok_or(ErrorCode::Overflow)?;
        require!(
            clock.unix_timestamp <= max_payment_time,
            ErrorCode::PaymentTooLate
        );

        require!(subscription.is_active, ErrorCode::SubscriptionInactive);
        require!(subscription_plan.is_active, ErrorCode::PlanInactive);
        require!(!subscription_plan.is_paused, ErrorCode::PlanPaused);

        // Transfer payment from subscriber to creator
        let cpi_accounts = Transfer {
            from: ctx.accounts.subscriber_token_account.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.subscriber.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, subscription_plan.price)?;

        // Update subscription with overflow checks
        subscription.last_payment = clock.unix_timestamp;
        subscription.next_payment = clock.unix_timestamp
            .checked_add(subscription_plan.interval_seconds)
            .ok_or(ErrorCode::Overflow)?;
        subscription.total_payments = subscription.total_payments
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PaymentProcessed {
            subscriber: subscription.subscriber,
            creator: subscription.creator,
            plan_id,
            amount: subscription_plan.price,
            payment_number: subscription.total_payments,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Cancel an active subscription
    /// 
    /// # Security
    /// - Only subscriber can cancel their own subscription
    /// - Safely decrements subscriber count
    pub fn cancel_subscription(
        ctx: Context<CancelSubscription>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription;
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let clock = Clock::get()?;

        require!(subscription.is_active, ErrorCode::SubscriptionInactive);

        subscription.is_active = false;
        
        // Safely decrement subscriber count
        subscription_plan.current_subscribers = subscription_plan.current_subscribers
            .checked_sub(1)
            .ok_or(ErrorCode::Underflow)?;

        emit!(SubscriptionCancelled {
            subscriber: subscription.subscriber,
            creator: subscription.creator,
            plan_id: subscription.plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Close a cancelled subscription and reclaim rent
    /// 
    /// # Security
    /// - Only subscriber can close their own subscription
    /// - Subscription must be inactive
    /// - Rent returned to subscriber
    pub fn close_subscription(
        ctx: Context<CloseSubscription>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription = &ctx.accounts.subscription;

        require!(!subscription.is_active, ErrorCode::SubscriptionStillActive);

        // Account will be closed automatically due to close constraint
        Ok(())
    }

    /// Update subscription plan parameters (creator only)
    /// 
    /// # Note
    /// Price changes affect ALL subscribers including existing ones.
    /// Consider implementing versioning for production use.
    pub fn update_subscription_plan(
        ctx: Context<UpdateSubscriptionPlan>,
        plan_id: u64,
        new_price: Option<u64>,
        new_interval: Option<i64>,
        new_max_subscribers: Option<u32>,
        new_metadata_uri: Option<String>,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let clock = Clock::get()?;

        if let Some(price) = new_price {
            require!(price > 0, ErrorCode::InvalidPrice);
            subscription_plan.price = price;
        }
        if let Some(interval) = new_interval {
            require!(interval >= 60, ErrorCode::IntervalTooShort);
            subscription_plan.interval_seconds = interval;
        }
        if let Some(max_subs) = new_max_subscribers {
            require!(max_subs > 0, ErrorCode::InvalidMaxSubscribers);
            require!(
                max_subs >= subscription_plan.current_subscribers,
                ErrorCode::MaxSubscribersTooLow
            );
            subscription_plan.max_subscribers = max_subs;
        }
        if let Some(metadata) = new_metadata_uri {
            require!(metadata.len() <= 200, ErrorCode::MetadataUriTooLong);
            subscription_plan.metadata_uri = metadata;
        }

        emit!(SubscriptionPlanUpdated {
            creator: subscription_plan.creator,
            plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Pause a subscription plan (creator only)
    /// 
    /// # Effect
    /// - No new subscriptions can be created
    /// - Existing subscriptions cannot process payments
    /// - Plan remains paused until explicitly unpaused
    pub fn pause_plan(
        ctx: Context<PausePlan>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let clock = Clock::get()?;
        
        require!(!subscription_plan.is_paused, ErrorCode::PlanAlreadyPaused);
        subscription_plan.is_paused = true;

        emit!(SubscriptionPlanPaused {
            creator: subscription_plan.creator,
            plan_id: subscription_plan.plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Unpause a subscription plan (creator only)
    pub fn unpause_plan(
        ctx: Context<UnpausePlan>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let clock = Clock::get()?;
        
        require!(subscription_plan.is_paused, ErrorCode::PlanNotPaused);
        subscription_plan.is_paused = false;

        emit!(SubscriptionPlanUnpaused {
            creator: subscription_plan.creator,
            plan_id: subscription_plan.plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Deactivate subscription plan permanently (creator only)
    /// 
    /// # Effect
    /// - Plan cannot accept new subscriptions
    /// - Existing subscriptions can still be cancelled
    /// - Cannot be reactivated
    pub fn deactivate_plan(
        ctx: Context<DeactivatePlan>,
        _plan_id: u64,
    ) -> Result<()> {
        let subscription_plan = &mut ctx.accounts.subscription_plan;
        let clock = Clock::get()?;
        
        require!(subscription_plan.is_active, ErrorCode::PlanAlreadyInactive);
        subscription_plan.is_active = false;

        emit!(SubscriptionPlanDeactivated {
            creator: subscription_plan.creator,
            plan_id: subscription_plan.plan_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

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
        bump = subscription_plan.bump
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
    #[account(
        mut,
        constraint = subscriber_token_account.owner == subscriber.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = subscriber_token_account.mint == creator_token_account.mint @ ErrorCode::MintMismatch,
    )]
    pub subscriber_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = creator_token_account.owner == subscription_plan.creator @ ErrorCode::InvalidTokenAccountOwner,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct ProcessPayment<'info> {
    #[account(
        seeds = [b"subscription_plan", subscription_plan.creator.as_ref(), &plan_id.to_le_bytes()],
        bump = subscription_plan.bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription.bump,
        constraint = subscription.plan_id == plan_id @ ErrorCode::InvalidPlanId,
        constraint = subscription.subscriber == subscriber.key() @ ErrorCode::InvalidSubscriber,
    )]
    pub subscription: Account<'info, Subscription>,
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(
        mut,
        constraint = subscriber_token_account.owner == subscriber.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = subscriber_token_account.mint == creator_token_account.mint @ ErrorCode::MintMismatch,
    )]
    pub subscriber_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = creator_token_account.owner == subscription_plan.creator @ ErrorCode::InvalidTokenAccountOwner,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct CancelSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", subscription_plan.creator.as_ref(), &plan_id.to_le_bytes()],
        bump = subscription_plan.bump
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription.bump,
        has_one = subscriber @ ErrorCode::InvalidSubscriber,
    )]
    pub subscription: Account<'info, Subscription>,
    pub subscriber: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct CloseSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription", subscriber.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription.bump,
        has_one = subscriber @ ErrorCode::InvalidSubscriber,
        close = subscriber
    )]
    pub subscription: Account<'info, Subscription>,
    #[account(mut)]
    pub subscriber: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct UpdateSubscriptionPlan<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription_plan.bump,
        has_one = creator @ ErrorCode::InvalidCreator,
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct PausePlan<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription_plan.bump,
        has_one = creator @ ErrorCode::InvalidCreator,
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: u64)]
pub struct UnpausePlan<'info> {
    #[account(
        mut,
        seeds = [b"subscription_plan", creator.key().as_ref(), &plan_id.to_le_bytes()],
        bump = subscription_plan.bump,
        has_one = creator @ ErrorCode::InvalidCreator,
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
        bump = subscription_plan.bump,
        has_one = creator @ ErrorCode::InvalidCreator,
    )]
    pub subscription_plan: Account<'info, SubscriptionPlan>,
    pub creator: Signer<'info>,
}

// ============================================================================
// Data Structures
// ============================================================================

#[account]
pub struct SubscriptionPlan {
    /// Creator's public key
    pub creator: Pubkey,
    /// Unique plan identifier
    pub plan_id: u64,
    /// Price per billing cycle (in smallest token unit)
    pub price: u64,
    /// Billing interval in seconds
    pub interval_seconds: i64,
    /// Maximum allowed subscribers
    pub max_subscribers: u32,
    /// Current number of active subscribers
    pub current_subscribers: u32,
    /// Whether plan accepts new subscriptions
    pub is_active: bool,
    /// Whether plan is temporarily paused
    pub is_paused: bool,
    /// URI to plan metadata (max 200 chars)
    pub metadata_uri: String,
    /// Creation timestamp
    pub created_at: i64,
    /// PDA bump seed
    pub bump: u8,
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
        1 + // is_paused
        4 + 200 + // metadata_uri (String with max 200 chars)
        8 + // created_at
        1; // bump
}

#[account]
pub struct Subscription {
    /// Subscriber's public key
    pub subscriber: Pubkey,
    /// Associated plan ID
    pub plan_id: u64,
    /// Plan creator's public key
    pub creator: Pubkey,
    /// Whether subscription is active
    pub is_active: bool,
    /// Timestamp of last payment
    pub last_payment: i64,
    /// Timestamp when next payment is due
    pub next_payment: i64,
    /// Total number of payments made
    pub total_payments: u64,
    /// PDA bump seed
    pub bump: u8,
}

impl Subscription {
    pub const LEN: usize = 8 + // discriminator
        32 + // subscriber
        8 + // plan_id
        32 + // creator
        1 + // is_active
        8 + // last_payment
        8 + // next_payment
        8 + // total_payments
        1; // bump
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct SubscriptionPlanCreated {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub price: u64,
    pub interval_seconds: i64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionCreated {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct PaymentProcessed {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
    pub amount: u64,
    pub payment_number: u64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionCancelled {
    pub subscriber: Pubkey,
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionPlanUpdated {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionPlanPaused {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionPlanUnpaused {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct SubscriptionPlanDeactivated {
    pub creator: Pubkey,
    pub plan_id: u64,
    pub timestamp: i64,
}

// ============================================================================
// Error Codes
// ============================================================================

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
    #[msg("Price must be greater than 0")]
    InvalidPrice,
    #[msg("Interval must be at least 60 seconds")]
    IntervalTooShort,
    #[msg("Max subscribers must be greater than 0")]
    InvalidMaxSubscribers,
    #[msg("Metadata URI exceeds 200 character limit")]
    MetadataUriTooLong,
    #[msg("Mathematical overflow occurred")]
    Overflow,
    #[msg("Mathematical underflow occurred")]
    Underflow,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Token account mint mismatch")]
    MintMismatch,
    #[msg("Subscription plan is paused")]
    PlanPaused,
    #[msg("Payment is too late (beyond grace period)")]
    PaymentTooLate,
    #[msg("Subscription is still active, cannot close")]
    SubscriptionStillActive,
    #[msg("New max subscribers cannot be less than current subscribers")]
    MaxSubscribersTooLow,
    #[msg("Invalid creator")]
    InvalidCreator,
    #[msg("Invalid subscriber")]
    InvalidSubscriber,
    #[msg("Invalid plan ID")]
    InvalidPlanId,
    #[msg("Plan is already paused")]
    PlanAlreadyPaused,
    #[msg("Plan is not paused")]
    PlanNotPaused,
    #[msg("Plan is already inactive")]
    PlanAlreadyInactive,
}
