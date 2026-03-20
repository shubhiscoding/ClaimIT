"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";

export function WalletButton() {
  const { wallet, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const shortAddress = useMemo(() => {
    if (!publicKey) return "";
    const base58 = publicKey.toBase58();
    return base58.slice(0, 4) + "..." + base58.slice(-4);
  }, [publicKey]);

  if (publicKey) {
    return (
      <button
        onClick={disconnect}
        className="border-2 border-[var(--border)] bg-white px-5 py-2.5 font-semibold shadow-brutal-sm transition-all hover:bg-red-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
      >
        {shortAddress} · Disconnect
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-5 py-2.5 font-semibold shadow-brutal-sm transition-all hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] cursor-pointer disabled:opacity-50"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
