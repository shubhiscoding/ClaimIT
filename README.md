# ClaimIt — Solana Fund Recovery

**Recover tokens and reclaim rent from compromised Solana wallets in minutes, not hours.**

When a Solana wallet gets compromised, every second counts. Drainer bots monitor for incoming SOL and sweep it instantly — making it nearly impossible to rescue your tokens through normal transfers. ClaimIt solves this by using a separate funding wallet to pay for gas, letting you move tokens out of the compromised wallet without ever sending SOL into it.

---

## Why ClaimIt?

Traditional recovery from a compromised wallet is a nightmare:

- You can't send SOL for gas fees — drainers will steal it instantly
- Manually building multi-signature transactions requires deep Solana knowledge
- Token accounts hold ~0.002 SOL in rent each, locked away and forgotten

ClaimIt handles all of this in a guided, step-by-step flow that anyone can use.

---

## Features

### Fund Recovery
- **Dual-wallet signing** — Your funding wallet pays for gas while tokens move out of the compromised wallet. No SOL ever enters the compromised wallet.
- **Token metadata display** — See token names, symbols, and images fetched via Helius DAS API so you know exactly what you're recovering.
- **Batch transactions** — Recovers multiple tokens efficiently in batched transactions.
- **Rent reclamation** — Automatically closes token accounts in the compromised wallet and reclaims the ~0.002 SOL rent per account.
- **Smart ATA detection** — Checks if your funding wallet already has token accounts, so you know the net rent yield per token before signing.
- **Transaction results** — View transaction hashes with direct Solscan links after recovery.

### Rent Claiming (`/rent`)
- **Scan any wallet** — Connect your wallet to find all empty token accounts holding reclaimable rent.
- **Bulk close** — Select individual accounts or close them all at once.
- **Custom destination** — Send reclaimed SOL to any wallet address, not just the connected one.

### User Experience
- **Neo-brutalist UI** — Clean, bold design that's easy to navigate under stress.
- **Back navigation** — Every step is reversible. Go back and change your selection at any time.
- **Wallet persistence** — Compromised and funding wallet addresses persist across page reloads via localStorage.
- **Guided flow** — A landing page explains exactly what you need and what you'll get before you start.

---

## How It Works

```
1. Connect Compromised Wallet  →  Lock in the wallet you want to recover from
2. Connect Funding Wallet      →  Lock in a safe wallet with SOL for gas
3. Select Tokens               →  Pick which tokens and accounts to recover
4. Sign with Funding Wallet    →  Funding wallet signs to pay for gas + ATA creation
5. Switch to Compromised       →  Switch back to sign the token transfers
6. Sign & Send                 →  Transactions broadcast and tokens are recovered
```

The compromised wallet is connected first — this means you only need to switch wallets **once** during the entire process.

---

## DEMO

https://github.com/user-attachments/assets/6d2a1bd6-ba8e-458d-9d26-04b3983a5d67

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Solana RPC endpoint (e.g., [Helius](https://helius.dev), [QuickNode](https://quicknode.com))

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/claimIt.git
cd claimIt

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with your values:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_TREASURY_WALLET=YOUR_TREASURY_WALLET_ADDRESS
NEXT_PUBLIC_DEMO_VIDEO_URL=https://your-demo-video-url
NEXT_PUBLIC_CONTACT_URL=https://your-contact-url
```

### Run

```bash
# Development
npm run dev

# Production build
npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000) to start recovering funds.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC endpoint (Helius recommended for DAS API support) |
| `NEXT_PUBLIC_TREASURY_WALLET` | Yes | Treasury wallet for service fees |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | No | Link to demo video (shown in footer) |
| `NEXT_PUBLIC_CONTACT_URL` | No | Contact link (shown in footer) |

---

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **Solana Web3.js** + **SPL Token** for blockchain interactions
- **Solana Wallet Adapter** for wallet connections
- **Helius DAS API** for token metadata
- **Jupiter API** for token price quotes

---

## Fee Structure

| Action | Fee | Details |
|--------|-----|---------|
| Token Recovery | 10% of token SOL value | Based on Jupiter quote; minimum 0.0001 SOL |
| Rent Claiming | 1% of rent reclaimed | Applied to total rent from closed accounts |

