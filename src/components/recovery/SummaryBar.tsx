"use client";

import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { TokenAccountInfo } from "@/hooks/useAllTokenAccounts";

const RENT_PER_ACCOUNT = 0.00203928;

interface SummaryBarProps {
  compromisedPublicKey: PublicKey;
  fundingPublicKey: PublicKey | null;
  tokenAccounts: TokenAccountInfo[];
  emptyAccounts: TokenAccountInfo[];
  selectedTokens: Set<string>;
  selectedEmpty: Set<string>;
  loading: boolean;
}

export function SummaryBar({
  compromisedPublicKey,
  fundingPublicKey,
  tokenAccounts,
  emptyAccounts,
  selectedTokens,
  selectedEmpty,
  loading,
}: SummaryBarProps) {
  const totalRent = emptyAccounts.length * RENT_PER_ACCOUNT;
  const selectedRent = selectedEmpty.size * RENT_PER_ACCOUNT;

  const addr = compromisedPublicKey.toBase58();
  const shortAddr = addr.slice(0, 4) + "..." + addr.slice(-4);
  const fundAddr = fundingPublicKey?.toBase58();
  const shortFundAddr = fundAddr
    ? fundAddr.slice(0, 4) + "..." + fundAddr.slice(-4)
    : null;

  const totalTokenCount = tokenAccounts.length;
  const selectedTokenCount = selectedTokens.size;

  return (
    <div className="border-3 border-[var(--border)] bg-white shadow-brutal">
      {/* Wallet indicators */}
      <div className="px-6 py-3 border-b-2 border-dashed border-gray-200 flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-400 rounded-full" />
          <span className="text-xs font-medium text-[var(--muted)]">
            Compromised
          </span>
          <span className="font-mono text-xs text-[var(--fg)]">{shortAddr}</span>
        </div>
        {shortFundAddr && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-xs font-medium text-[var(--muted)]">
              Funding
            </span>
            <span className="font-mono text-xs text-[var(--fg)]">{shortFundAddr}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--muted)]">Scanning wallet...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
          <StatCell
            label="Recoverable Tokens"
            value={totalTokenCount.toString()}
            sub={`${selectedTokenCount} selected`}
            accent={false}
          />
          <StatCell
            label="Reclaimable Rent"
            value={`${totalRent.toFixed(4)}`}
            sub={`${selectedRent.toFixed(4)} SOL selected`}
            accent={false}
          />
          <StatCell
            label="Selected Tokens"
            value={selectedTokenCount.toString()}
            sub={`of ${totalTokenCount}`}
            accent={selectedTokenCount > 0}
          />
          <StatCell
            label="Selected Rent"
            value={`${selectedRent.toFixed(4)}`}
            sub={`${selectedEmpty.size} accounts`}
            accent={selectedEmpty.size > 0}
          />
        </div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-black tabular-nums ${
          accent ? "text-[var(--accent)]" : "text-[var(--fg)]"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--muted)] mt-0.5">{sub}</p>
    </div>
  );
}
