use anchor_lang::prelude::*;

// Placeholder program id. `anchor keys sync` rewrites this to match the
// generated program keypair at build time, so the deployed bytecode's
// program-id check matches the deploy address on devnet.
declare_id!("4nkivxL5RbP5S64wZi6FgzbrJqWra633RcX5QjbRKpU4");

/// Minimal counter program used as the rails' devnet deploy fixture.
///
/// Each authority owns one counter account at the PDA `["counter", authority]`.
/// Only that authority can initialize or increment its counter.
#[program]
pub mod anchor_counter {
    use super::*;

    /// Create the counter PDA for the signing authority, starting at zero.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.authority.key();
        counter.count = 0;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    /// Increment the authority's counter by one.
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).ok_or(CounterError::Overflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter", authority.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(
        mut,
        seeds = [b"counter", authority.key().as_ref()],
        bump = counter.bump,
        has_one = authority @ CounterError::Unauthorized
    )]
    pub counter: Account<'info, Counter>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    /// The only signer allowed to increment this counter.
    pub authority: Pubkey,
    /// Current count value.
    pub count: u64,
    /// Canonical bump stored at initialization.
    pub bump: u8,
}

#[error_code]
pub enum CounterError {
    #[msg("Counter increment overflowed.")]
    Overflow,
    #[msg("Only the counter authority may perform this action.")]
    Unauthorized,
}
