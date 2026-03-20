"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { useState, useMemo, useCallback } from "react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";
import {
  useEmptyTokenAccounts,
  EmptyTokenAccount,
} from "@/hooks/useEmptyTokenAccounts";

const RENT_PER_ACCOUNT = 0.00203928;
const MAX_ACCOUNTS_PER_TX = 20; // safe limit to avoid tx size issues

export function TokenAccountList() {
  const { publicKey, sendTransaction } = useWallet();
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);
  const { accounts, loading, error, refetch } = useEmptyTokenAccounts();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const allSelected =
    accounts.length > 0 && selected.size === accounts.length;

  const toggleAccount = useCallback((pubkey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.pubkey.toBase58())));
    }
  }, [allSelected, accounts]);

  const totalClaimable = useMemo(
    () => selected.size * RENT_PER_ACCOUNT,
    [selected.size]
  );

  const handleClaim = useCallback(async () => {
    if (!publicKey || selected.size === 0) return;

    setClaiming(true);
    setClaimResult(null);
    let success = 0;
    let failed = 0;

    try {
      const selectedAccounts = accounts.filter((a) =>
        selected.has(a.pubkey.toBase58())
      );

      // Batch into multiple transactions if needed
      for (let i = 0; i < selectedAccounts.length; i += MAX_ACCOUNTS_PER_TX) {
        const batch = selectedAccounts.slice(i, i + MAX_ACCOUNTS_PER_TX);
        const transaction = new Transaction();

        for (const account of batch) {
          transaction.add(
            createCloseAccountInstruction(
              account.pubkey,
              publicKey, // destination - rent goes here
              publicKey // owner/authority
            )
          );
        }

        try {
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          const signature = await sendTransaction(transaction, connection);
          await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          success += batch.length;
        } catch {
          failed += batch.length;
        }
      }

      setClaimResult({ success, failed });
      setSelected(new Set());
      // Refresh the account list
      setTimeout(() => refetch(), 2000);
    } finally {
      setClaiming(false);
    }
  }, [publicKey, selected, accounts, connection, sendTransaction, refetch]);

  if (!publicKey) {
    return (
      <div className="text-center py-20">
        <div className="inline-block border-2 border-[var(--border)] bg-white p-8 shadow-brutal-sm">
          <p className="text-lg font-medium text-[var(--muted)]">
            Connect your wallet to get started
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block border-2 border-[var(--border)] bg-white p-8 shadow-brutal-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium">Scanning token accounts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-block border-2 border-red-500 bg-red-50 p-8 shadow-brutal-sm">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 border-2 border-[var(--border)] bg-white px-4 py-2 font-semibold shadow-brutal-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-block border-2 border-[var(--border)] bg-white p-8 shadow-brutal-sm">
          <p className="text-lg font-medium">No empty token accounts found</p>
          <p className="text-[var(--muted)] mt-2 text-sm">
            Your wallet is clean — nothing to reclaim!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-[var(--border)] bg-white p-4 shadow-brutal-sm">
        <div>
          <p className="text-sm text-[var(--muted)]">Empty token accounts</p>
          <p className="text-2xl font-bold">{accounts.length}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">Total reclaimable</p>
          <p className="text-2xl font-bold text-[var(--accent)]">
            {(accounts.length * RENT_PER_ACCOUNT).toFixed(6)} SOL
          </p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">Selected</p>
          <p className="text-2xl font-bold">
            {selected.size}{" "}
            <span className="text-base font-normal text-[var(--muted)]">
              ({totalClaimable.toFixed(6)} SOL)
            </span>
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="border-2 border-[var(--border)] bg-white px-4 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>

        <button
          onClick={handleClaim}
          disabled={selected.size === 0 || claiming}
          className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-6 py-2.5 font-bold shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent)] disabled:active:shadow-brutal-sm disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          {claiming
            ? "Claiming..."
            : `Claim ${totalClaimable.toFixed(6)} SOL`}
        </button>
      </div>

      {/* Result toast */}
      {claimResult && (
        <div
          className={`border-2 p-4 font-medium ${
            claimResult.failed === 0
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-yellow-600 bg-yellow-50 text-yellow-700"
          } shadow-brutal-sm`}
        >
          {claimResult.success > 0 && (
            <span>
              Closed {claimResult.success} account
              {claimResult.success > 1 ? "s" : ""} and reclaimed{" "}
              {(claimResult.success * RENT_PER_ACCOUNT).toFixed(6)} SOL!
            </span>
          )}
          {claimResult.failed > 0 && (
            <span className="ml-2">
              {claimResult.failed} account
              {claimResult.failed > 1 ? "s" : ""} failed to close.
            </span>
          )}
        </div>
      )}

      {/* Account list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {accounts.map((account) => {
          const key = account.pubkey.toBase58();
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleAccount(key)}
              className={`w-full text-left border-2 p-3 transition-all cursor-pointer flex items-center gap-3 ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-brutal-sm"
                  : "border-[var(--border)] bg-white hover:bg-gray-50"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] border-[var(--accent)]"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Account info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate">{key}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Mint: {account.mint.slice(0, 8)}...{account.mint.slice(-8)}
                </p>
              </div>

              {/* Rent amount */}
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-sm text-[var(--accent)]">
                  {RENT_PER_ACCOUNT.toFixed(6)}
                </p>
                <p className="text-xs text-[var(--muted)]">SOL</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
