"use client";

import { WalletButton } from "@/components/WalletButton";
import { TokenAccountList } from "@/components/TokenAccountList";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b-3 border-[var(--border)] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)] border-2 border-[var(--border)] shadow-brutal-sm flex items-center justify-center">
              <span className="text-white font-black text-lg">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">
                ClaimIt
              </h1>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Reclaim SOL from empty token accounts
              </p>
            </div>
          </div>
          <WalletButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <TokenAccountList />
      </main>

      {/* Footer */}
      <footer className="border-t-3 border-[var(--border)] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-[var(--muted)] text-center">
            Each empty token account holds ~0.00204 SOL in rent. Closing them
            returns that SOL to your wallet. No fees beyond network transaction
            costs.
          </p>
        </div>
      </footer>
    </div>
  );
}
