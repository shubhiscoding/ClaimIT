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
    </>
  );
}
