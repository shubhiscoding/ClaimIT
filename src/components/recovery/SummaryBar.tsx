"use client";

import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
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
  fundingMints: Set<string>;
  onReset: () => void;
  onDisconnect: () => void;
}

export function SummaryBar({
  compromisedPublicKey,
  fundingPublicKey,
  tokenAccounts,
  emptyAccounts,
  selectedTokens,
  selectedEmpty,
  loading,
  fundingMints,
  onReset,
  onDisconnect,
}: SummaryBarProps) {
  // Rent from empty accounts
  const emptyRent = emptyAccounts.length * RENT_PER_ACCOUNT;
  const selectedEmptyRent = selectedEmpty.size * RENT_PER_ACCOUNT;

  // Rent from token accounts: closing yields rent, but creating ATA costs rent if funding wallet doesn't have it
  const tokenRentNet = tokenAccounts.reduce((acc, a) => {
    const hasAta = fundingMints.has(a.mint);
    return acc + RENT_PER_ACCOUNT - (hasAta ? 0 : RENT_PER_ACCOUNT);
  }, 0);

  const selectedTokenRentNet = tokenAccounts
    .filter((a) => selectedTokens.has(a.pubkey.toBase58()))
    .reduce((acc, a) => {
      const hasAta = fundingMints.has(a.mint);
      return acc + RENT_PER_ACCOUNT - (hasAta ? 0 : RENT_PER_ACCOUNT);
    }, 0);

  const totalRent = emptyRent + tokenRentNet;
  const selectedRent = selectedEmptyRent + selectedTokenRentNet;

  const addr = compromisedPublicKey.toBase58();
  const shortAddr = addr.slice(0, 4) + "..." + addr.slice(-4);
  const fundAddr = fundingPublicKey?.toBase58();
  const shortFundAddr = fundAddr
    ? fundAddr.slice(0, 4) + "..." + fundAddr.slice(-4)
    : null;

  const totalTokenCount = tokenAccounts.length;
  const selectedTokenCount = selectedTokens.size;

  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="border-3 border-[var(--border)] bg-white shadow-brutal">
        {/* Wallet indicators — clickable */}
        <div className="px-6 py-3 border-b-2 border-dashed border-gray-200 flex items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-2.5 py-1 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--bg)] transition-all cursor-pointer rounded-none"
          >
            <div className="w-2 h-2 bg-red-400 rounded-full" />
            <span className="text-xs font-medium text-[var(--muted)]">
              Compromised
            </span>
            <span className="font-mono text-xs text-[var(--fg)]">
              {shortAddr}
            </span>
            <svg
              className="w-3 h-3 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
            </svg>
          </button>

          {shortFundAddr && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-2.5 py-1 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--bg)] transition-all cursor-pointer rounded-none"
            >
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs font-medium text-[var(--muted)]">
                Funding
              </span>
              <span className="font-mono text-xs text-[var(--fg)]">
                {shortFundAddr}
              </span>
              <svg
                className="w-3 h-3 text-[var(--muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
          )}
          </div>

          <button
            onClick={onDisconnect}
            className="border-2 border-red-400 text-red-500 px-3 py-1 text-xs font-bold cursor-pointer hover:bg-red-50 transition-all"
          >
            Disconnect
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-6 flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--muted)]">
              Scanning wallet...
            </span>
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

      {/* Change Wallets Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowModal(false)}
        >
          <div
            className="border-3 border-[var(--border)] bg-white shadow-brutal w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-3 border-[var(--border)] px-6 py-4">
              <h3 className="text-lg font-black">Wallet Configuration</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 border-2 border-[var(--border)] flex items-center justify-center hover:bg-gray-100 cursor-pointer font-bold text-sm"
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-5">
              {/* Funding wallet */}
              {fundAddr && (
                <div className="border-2 border-[var(--border)] p-4 bg-[var(--bg)]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                    <span className="text-sm font-bold">Funding Wallet</span>
                  </div>
                  <p className="font-mono text-xs break-all">{fundAddr}</p>
                </div>
              )}

              {/* Compromised wallet */}
              <div className="border-2 border-[var(--border)] p-4 bg-[var(--bg)]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                  <span className="text-sm font-bold">Compromised Wallet</span>
                </div>
                <p className="font-mono text-xs break-all">{addr}</p>
              </div>

              <div className="border-2 border-yellow-400 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-700">
                  Changing wallets will restart the recovery process from the
                  beginning.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t-3 border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border-2 border-[var(--border)] bg-white px-4 py-3 font-semibold shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Keep Current
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  onReset();
                }}
                className="flex-1 border-2 border-[var(--border)] bg-red-500 text-white px-4 py-3 font-bold shadow-brutal-sm transition-all cursor-pointer hover:bg-red-600 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Change Wallets
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
