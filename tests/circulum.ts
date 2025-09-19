import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// Note: This import will work after running 'anchor build'
// The types file will be generated based on the program name in Anchor.toml
import { Circulum } from "../target/types/circulum";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("Circulum", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Circulum as Program<Circulum>;
  const provider = anchor.getProvider();

  // Test accounts
  let creator: Keypair;
  let subscriber: Keypair;
  let tokenMint: PublicKey;
  let creatorTokenAccount: PublicKey;
  let subscriberTokenAccount: PublicKey;

  const planId = new anchor.BN(1);
  const price = new anchor.BN(1000000); // 0.001 SOL in lamports
  const intervalSeconds = new anchor.BN(2592000); // 30 days
  const maxSubscribers = 1000;
  const metadataUri = "https://example.com/metadata.json";

  before(async () => {
    // Initialize test accounts
    creator = Keypair.generate();
    subscriber = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(creator.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(subscriber.publicKey, 2 * LAMPORTS_PER_SOL)
    );

    // Create a test token mint
    tokenMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6 // 6 decimals
    );

    // Create token accounts
    creatorTokenAccount = await createAccount(
      provider.connection,
      creator,
      tokenMint,
      creator.publicKey
    );

    subscriberTokenAccount = await createAccount(
      provider.connection,
      subscriber,
      tokenMint,
      subscriber.publicKey
    );

    // Mint tokens to subscriber for testing payments
    await mintTo(
      provider.connection,
      creator,
      tokenMint,
      subscriberTokenAccount,
      creator,
      1000000000 // 1000 tokens
    );
  });

  it("Creates a subscription plan", async () => {
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createSubscriptionPlan(
        planId,
        price,
        intervalSeconds,
        maxSubscribers,
        metadataUri
      )
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Fetch the created subscription plan
    const subscriptionPlan = await program.account.subscriptionPlan.fetch(
      subscriptionPlanPda
    );

    assert.ok(subscriptionPlan.creator.equals(creator.publicKey));
    assert.ok(subscriptionPlan.planId.eq(planId));
    assert.ok(subscriptionPlan.price.eq(price));
    assert.ok(subscriptionPlan.intervalSeconds.eq(intervalSeconds));
    assert.equal(subscriptionPlan.maxSubscribers, maxSubscribers);
    assert.equal(subscriptionPlan.currentSubscribers, 0);
    assert.equal(subscriptionPlan.isActive, true);
    assert.equal(subscriptionPlan.metadataUri, metadataUri);
  });

  it("Subscribes to a plan", async () => {
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [subscriptionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription"),
        subscriber.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .subscribe(planId)
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        subscription: subscriptionPda,
        subscriber: subscriber.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([subscriber])
      .rpc();

    // Fetch the created subscription
    const subscription = await program.account.subscription.fetch(subscriptionPda);
    const subscriptionPlan = await program.account.subscriptionPlan.fetch(
      subscriptionPlanPda
    );

    assert.ok(subscription.subscriber.equals(subscriber.publicKey));
    assert.ok(subscription.planId.eq(planId));
    assert.ok(subscription.creator.equals(creator.publicKey));
    assert.equal(subscription.isActive, true);
    assert.equal(subscription.totalPayments.toNumber(), 0);
    assert.equal(subscriptionPlan.currentSubscribers, 1);
  });

  it("Processes a payment", async () => {
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [subscriptionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription"),
        subscriber.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Get initial balances
    const initialCreatorBalance = await provider.connection.getTokenAccountBalance(
      creatorTokenAccount
    );
    const initialSubscriberBalance = await provider.connection.getTokenAccountBalance(
      subscriberTokenAccount
    );

    // Wait for payment to be due (in a real test, you might manipulate time)
    // For now, we'll modify the subscription to make payment due
    const subscription = await program.account.subscription.fetch(subscriptionPda);
    
    await program.methods
      .processPayment(planId)
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        subscription: subscriptionPda,
        subscriber: subscriber.publicKey,
        subscriberTokenAccount: subscriberTokenAccount,
        creatorTokenAccount: creatorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([subscriber])
      .rpc();

    // Fetch updated subscription
    const updatedSubscription = await program.account.subscription.fetch(subscriptionPda);

    assert.equal(updatedSubscription.totalPayments.toNumber(), 1);
    assert.ok(updatedSubscription.lastPayment.gt(subscription.lastPayment));
    assert.ok(updatedSubscription.nextPayment.gt(subscription.nextPayment));
  });

  it("Cancels a subscription", async () => {
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [subscriptionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription"),
        subscriber.publicKey.toBuffer(),
        planId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .cancelSubscription(planId)
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        subscription: subscriptionPda,
        subscriber: subscriber.publicKey,
      })
      .signers([subscriber])
      .rpc();

    // Fetch updated subscription and plan
    const subscription = await program.account.subscription.fetch(subscriptionPda);
    const subscriptionPlan = await program.account.subscriptionPlan.fetch(
      subscriptionPlanPda
    );

    assert.equal(subscription.isActive, false);
    assert.equal(subscriptionPlan.currentSubscribers, 0);
  });

  it("Updates a subscription plan", async () => {
    const newPlanId = new anchor.BN(2);
    const newPrice = new anchor.BN(2000000); // 0.002 SOL
    const newInterval = new anchor.BN(604800); // 7 days
    const newMaxSubscribers = 500;
    const newMetadataUri = "https://example.com/new-metadata.json";

    // First create a new plan
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        newPlanId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createSubscriptionPlan(
        newPlanId,
        price,
        intervalSeconds,
        maxSubscribers,
        metadataUri
      )
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Now update it
    await program.methods
      .updateSubscriptionPlan(
        newPlanId,
        newPrice,
        newInterval,
        newMaxSubscribers,
        newMetadataUri
      )
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    // Fetch updated plan
    const updatedPlan = await program.account.subscriptionPlan.fetch(
      subscriptionPlanPda
    );

    assert.ok(updatedPlan.price.eq(newPrice));
    assert.ok(updatedPlan.intervalSeconds.eq(newInterval));
    assert.equal(updatedPlan.maxSubscribers, newMaxSubscribers);
    assert.equal(updatedPlan.metadataUri, newMetadataUri);
  });

  it("Deactivates a subscription plan", async () => {
    const planToDeactivate = new anchor.BN(2);
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        planToDeactivate.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .deactivatePlan(planToDeactivate)
      .accounts({
        subscriptionPlan: subscriptionPlanPda,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    // Fetch updated plan
    const deactivatedPlan = await program.account.subscriptionPlan.fetch(
      subscriptionPlanPda
    );

    assert.equal(deactivatedPlan.isActive, false);
  });

  it("Fails to subscribe to inactive plan", async () => {
    const inactivePlanId = new anchor.BN(2);
    const [subscriptionPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription_plan"),
        creator.publicKey.toBuffer(),
        inactivePlanId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [subscriptionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription"),
        subscriber.publicKey.toBuffer(),
        inactivePlanId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .subscribe(inactivePlanId)
        .accounts({
          subscriptionPlan: subscriptionPlanPda,
          subscription: subscriptionPda,
          subscriber: subscriber.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([subscriber])
        .rpc();
      
      assert.fail("Should have failed to subscribe to inactive plan");
    } catch (error) {
      assert.include(error.toString(), "PlanInactive");
    }
  });
});
