"use client";

import { WalletButton } from "@/components/WalletButton";
import { TokenAccountList } from "@/components/TokenAccountList";

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">ClaimIt</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Reclaim rent from empty Solana token accounts
          </p>
        </div>
        <WalletButton />
      </header>

      {/* Main content */}
      <main>
        <TokenAccountList />
      </main>

      {/* Footer */}
      <footer className="mt-16 pt-6 border-t-2 border-[var(--border)]">
        <p className="text-xs text-[var(--muted)] text-center">
          Each empty token account holds ~0.00204 SOL in rent. Closing them
          sends that SOL back to your wallet.
        </p>
      </footer>
    </div>
  );
}
