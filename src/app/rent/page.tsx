"use client";

import { WalletButton } from "@/components/WalletButton";
import { TokenAccountList } from "@/components/TokenAccountList";

export default function RentPage() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-4 flex justify-end">
        <WalletButton />
      </div>
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <TokenAccountList />
      </div>
      <footer className="border-t-3 border-[var(--border)] bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-[var(--muted)] text-center">
            Each empty token account holds ~0.00204 SOL in rent. Closing them
            returns that SOL to your wallet. No fees beyond network transaction
            costs.
          </p>
        </div>
      </footer>
    </>
  );
}
