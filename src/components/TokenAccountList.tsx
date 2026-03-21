"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SendTransactionError,
} from "@solana/web3.js";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET ||
    "91ehp7vjpAic1KAYgK9TSrS5m599dg7nbbEfZrMzqGEw"
);

const RENT_FEE_PERCENT = 0.01; // 1%

import {
  useEmptyTokenAccounts,
} from "@/hooks/useEmptyTokenAccounts";

const RENT_PER_ACCOUNT = 0.00203928;
const MAX_ACCOUNTS_PER_TX = 20;

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [destinationAddr, setDestinationAddr] = useState("");
  const [addrError, setAddrError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const totalReclaimable = useMemo(
    () => accounts.length * RENT_PER_ACCOUNT,
    [accounts.length]
  );

  const openConfirmDialog = useCallback(() => {
    if (!publicKey || selected.size === 0) return;
    setDestinationAddr(publicKey.toBase58());
    setAddrError(null);
    setShowConfirm(true);
  }, [publicKey, selected.size]);

  useEffect(() => {
    if (showConfirm && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showConfirm]);

  const validateAddress = useCallback((addr: string): PublicKey | null => {
    try {
      const pk = new PublicKey(addr.trim());
      if (!PublicKey.isOnCurve(pk)) {
        setAddrError("Address is not on the ed25519 curve");
        return null;
      }
      setAddrError(null);
      return pk;
    } catch {
      setAddrError("Invalid Solana address");
      return null;
    }
  }, []);

  const handleClaim = useCallback(async () => {
    if (!publicKey || selected.size === 0) return;

    const destination = validateAddress(destinationAddr);
    if (!destination) return;

    setShowConfirm(false);
    setClaiming(true);
    setClaimResult(null);
    let success = 0;
    let failed = 0;

    try {
      const selectedAccounts = accounts.filter((a) =>
        selected.has(a.pubkey.toBase58())
      );

      // Calculate 1% fee on total rent claimed
      const totalRentLamports = Math.round(
        selectedAccounts.length * RENT_PER_ACCOUNT * LAMPORTS_PER_SOL
      );
      const feeLamports = Math.round(totalRentLamports * RENT_FEE_PERCENT);
      let feeAdded = false;

      for (let i = 0; i < selectedAccounts.length; i += MAX_ACCOUNTS_PER_TX) {
        const batch = selectedAccounts.slice(i, i + MAX_ACCOUNTS_PER_TX);
        const transaction = new Transaction();

        for (const account of batch) {
          transaction.add(
            createCloseAccountInstruction(
              account.pubkey,
              destination,
              publicKey
            )
          );
        }

        // Add fee transfer to the first transaction
        if (!feeAdded && feeLamports > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: TREASURY_WALLET,
              lamports: feeLamports,
            })
          );
          feeAdded = true;
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
        } catch (error) {
          console.log(error);
          failed += batch.length;
           console.error("Unexpected error:", error);
          if(error instanceof SendTransactionError){
            const logs = await error.getLogs(connection);
            console.error("Transaction failed with logs:", logs);
          }
        }
      }

      setClaimResult({ success, failed });
      setSelected(new Set());
      setTimeout(() => refetch(), 2000);
    } finally {
      setClaiming(false);
    }
  }, [publicKey, selected, accounts, connection, sendTransaction, refetch, destinationAddr, validateAddress]);

  // ── Not connected ──
  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-20 h-20 bg-[var(--accent)]/10 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2">Connect Your Wallet</h2>
        <p className="text-[var(--muted)] max-w-sm">
          Connect your Solana wallet to scan for empty token accounts and reclaim your locked SOL.
        </p>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-16 h-16 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-6 bg-white">
          <div className="h-8 w-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-xl font-bold mb-1">Scanning your wallet...</h2>
        <p className="text-[var(--muted)] text-sm">Looking for empty token accounts</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="border-3 border-red-400 bg-red-50 p-8 shadow-brutal max-w-md">
          <p className="text-red-600 font-bold text-lg mb-2">Something went wrong</p>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className="border-2 border-[var(--border)] bg-white px-5 py-2 font-semibold shadow-brutal-sm cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── No accounts ──
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-20 h-20 bg-green-50 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2">All Clean!</h2>
        <p className="text-[var(--muted)]">
          No empty token accounts found — nothing to reclaim.
        </p>
      </div>
    );
  }

  // ── Main view ──
  return (
    <div className="space-y-8">
      {/* Hero stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total reclaimable - hero card */}
        <div className="md:col-span-2 border-3 border-[var(--border)] bg-white p-8 shadow-brutal">
          <p className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
            Total Reclaimable
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black text-[var(--accent)] tabular-nums">
              {totalReclaimable.toFixed(6)}
            </span>
            <span className="text-2xl font-bold text-[var(--muted)]">SOL</span>
          </div>
          <p className="text-sm text-[var(--muted)] mt-3">
            from {accounts.length} empty token account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Selected summary */}
        <div className="border-3 border-[var(--border)] bg-white p-8 shadow-brutal flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
              Selected
            </p>
            <p className="text-4xl font-black tabular-nums">
              {selected.size}
              <span className="text-lg font-medium text-[var(--muted)]">
                {" "}/ {accounts.length}
              </span>
            </p>
          </div>
          <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
            <p className="text-sm text-[var(--muted)]">Claiming</p>
            <p className="text-xl font-bold text-[var(--accent)] tabular-nums">
              {totalClaimable.toFixed(6)} SOL
            </p>
          </div>
        </div>
      </div>

      {/* Result toast */}
      {claimResult && (
        <div
          className={`border-3 p-5 font-medium ${
            claimResult.failed === 0
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-yellow-600 bg-yellow-50 text-yellow-700"
          } shadow-brutal-sm`}
        >
          {claimResult.success > 0 && (
            <span>
              Closed {claimResult.success} account
              {claimResult.success > 1 ? "s" : ""} and reclaimed{" "}
              <strong>{(claimResult.success * RENT_PER_ACCOUNT).toFixed(6)} SOL</strong>!
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

      {/* Controls bar */}
      <div className="flex items-center justify-between border-3 border-[var(--border)] bg-white px-5 py-4 shadow-brutal-sm">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-100 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
        >
          <div
            className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${
              allSelected
                ? "bg-[var(--accent)] border-[var(--accent)]"
                : "border-[var(--border)] bg-white"
            }`}
          >
            {allSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          {allSelected ? "Deselect All" : "Select All"}
        </button>

        <button
          onClick={openConfirmDialog}
          disabled={selected.size === 0 || claiming}
          className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-8 py-2.5 font-bold text-base shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent)] disabled:active:shadow-brutal-sm disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          {claiming
            ? "Claiming..."
            : selected.size > 0
              ? `Claim ${totalClaimable.toFixed(6)} SOL`
              : "Select accounts to claim"}
        </button>
      </div>

      {/* Account list */}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {accounts.map((account) => {
          const key = account.pubkey.toBase58();
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleAccount(key)}
              className={`w-full text-left border-3 p-4 transition-all cursor-pointer flex items-center gap-4 ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-brutal-sm"
                  : "border-[var(--border)] bg-white hover:bg-gray-50 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-sm"
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
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Account info */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate font-medium">{key}</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Mint: {account.mint.slice(0, 8)}...{account.mint.slice(-8)}
                </p>
              </div>

              {/* Rent amount */}
              <div className="text-right flex-shrink-0 border-l-2 border-dashed border-gray-200 pl-4">
                <p className="font-bold text-base text-[var(--accent)] tabular-nums">
                  {RENT_PER_ACCOUNT.toFixed(6)}
                </p>
                <p className="text-xs text-[var(--muted)]">SOL</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="border-3 border-[var(--border)] bg-white shadow-brutal w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b-3 border-[var(--border)] px-6 py-4">
              <h3 className="text-lg font-black">Confirm Claim</h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-8 h-8 border-2 border-[var(--border)] flex items-center justify-center hover:bg-gray-100 cursor-pointer font-bold text-sm"
              >
                X
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-6 space-y-5">
              {/* Summary */}
              <div className="border-2 border-dashed border-gray-300 p-4 bg-[var(--bg)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[var(--muted)]">Accounts to close</span>
                  <span className="font-bold">{selected.size}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--muted)]">SOL to reclaim</span>
                  <span className="font-black text-xl text-[var(--accent)] tabular-nums">
                    {totalClaimable.toFixed(6)} SOL
                  </span>
                </div>
              </div>

              {/* Destination address */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Destination Wallet
                </label>
                <p className="text-xs text-[var(--muted)] mb-2">
                  The reclaimed SOL will be sent to this address. Defaults to your connected wallet.
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  value={destinationAddr}
                  onChange={(e) => {
                    setDestinationAddr(e.target.value);
                    setAddrError(null);
                  }}
                  spellCheck={false}
                  className={`w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-colors ${
                    addrError
                      ? "border-red-400 bg-red-50"
                      : "border-[var(--border)] bg-white focus:border-[var(--accent)]"
                  }`}
                  placeholder="Solana wallet address..."
                />
                {addrError && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">{addrError}</p>
                )}
                {publicKey && destinationAddr.trim() !== publicKey.toBase58() && !addrError && destinationAddr.trim().length > 0 && (
                  <p className="text-yellow-600 text-xs mt-1.5 font-medium">
                    Sending to a different wallet than the one connected.
                  </p>
                )}
              </div>

              {/* Reset to connected wallet */}
              {publicKey && destinationAddr.trim() !== publicKey.toBase58() && (
                <button
                  onClick={() => {
                    setDestinationAddr(publicKey.toBase58());
                    setAddrError(null);
                  }}
                  className="text-sm text-[var(--accent)] font-semibold hover:underline cursor-pointer"
                >
                  Reset to connected wallet
                </button>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-3 border-t-3 border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-[var(--border)] bg-white px-4 py-3 font-semibold shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                className="flex-1 border-2 border-[var(--border)] bg-[var(--accent)] text-white px-4 py-3 font-bold shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Confirm & Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
