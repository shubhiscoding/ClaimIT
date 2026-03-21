"use client";

import { Dispatch } from "react";
import { TokenAccountInfo } from "@/hooks/useAllTokenAccounts";

const RENT_PER_ACCOUNT = 0.00203928;

type Action =
  | { type: "TOGGLE_TOKEN"; pubkey: string }
  | { type: "TOGGLE_EMPTY"; pubkey: string }
  | { type: "SELECT_ALL_TOKENS"; pubkeys: string[] }
  | { type: "DESELECT_ALL_TOKENS" }
  | { type: "SELECT_ALL_EMPTY"; pubkeys: string[] }
  | { type: "DESELECT_ALL_EMPTY" };

interface Props {
  tokenAccounts: TokenAccountInfo[];
  emptyAccounts: TokenAccountInfo[];
  selectedTokens: Set<string>;
  selectedEmpty: Set<string>;
  dispatch: Dispatch<Action>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  hasSelections: boolean;
  onProceed: () => void;
  isClaiming: boolean;
  claimError: string | null;
  progress: { current: number; total: number };
}

export function StepSelectAccounts({
  tokenAccounts,
  emptyAccounts,
  selectedTokens,
  selectedEmpty,
  dispatch,
  loading,
  error,
  refetch,
  hasSelections,
  onProceed,
  isClaiming,
  claimError,
  progress,
}: Props) {
  const allTokensSelected =
    tokenAccounts.length > 0 && selectedTokens.size === tokenAccounts.length;
  const allEmptySelected =
    emptyAccounts.length > 0 && selectedEmpty.size === emptyAccounts.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-6 bg-white">
          <div className="h-8 w-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-xl font-bold mb-1">Scanning wallet...</h2>
        <p className="text-[var(--muted)] text-sm">
          Looking for recoverable tokens and empty accounts
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="border-3 border-red-400 bg-red-50 p-8 shadow-brutal max-w-md">
          <p className="text-red-600 font-bold text-lg mb-2">
            Something went wrong
          </p>
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

  if (tokenAccounts.length === 0 && emptyAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-green-50 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2">Nothing to Recover</h2>
        <p className="text-[var(--muted)]">
          No token accounts found on this wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 border-2 border-[var(--border)] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
          3
        </span>
        <h2 className="text-lg font-bold">Select accounts to recover</h2>
      </div>

      {/* Tokens with balance */}
      {tokenAccounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">
              Tokens with Balance{" "}
              <span className="text-[var(--muted)] font-normal text-sm">
                ({tokenAccounts.length})
              </span>
            </h3>
            <button
              onClick={() =>
                allTokensSelected
                  ? dispatch({ type: "DESELECT_ALL_TOKENS" })
                  : dispatch({
                      type: "SELECT_ALL_TOKENS",
                      pubkeys: tokenAccounts.map((a) => a.pubkey.toBase58()),
                    })
              }
              className="flex items-center gap-2 border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 font-semibold text-xs shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-100 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Checkbox checked={allTokensSelected} />
              {allTokensSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {tokenAccounts.map((account) => {
              const key = account.pubkey.toBase58();
              const isSelected = selectedTokens.has(key);
              return (
                <button
                  key={key}
                  onClick={() =>
                    dispatch({ type: "TOGGLE_TOKEN", pubkey: key })
                  }
                  className={`w-full text-left border-3 p-4 transition-all cursor-pointer flex items-center gap-4 ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-brutal-sm"
                      : "border-[var(--border)] bg-white hover:bg-gray-50"
                  }`}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate font-medium">
                      {key}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Mint: {account.mint.slice(0, 8)}...
                      {account.mint.slice(-8)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 border-l-2 border-dashed border-gray-200 pl-4">
                    <p className="font-bold text-base text-[var(--accent)] tabular-nums">
                      {account.uiAmount.toLocaleString(undefined, {
                        maximumFractionDigits: account.decimals,
                      })}
                    </p>
                    <p className="text-xs text-[var(--muted)]">tokens</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty accounts (rent) */}
      {emptyAccounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">
              Empty Accounts (Rent){" "}
              <span className="text-[var(--muted)] font-normal text-sm">
                ({emptyAccounts.length}) &middot;{" "}
                {(emptyAccounts.length * RENT_PER_ACCOUNT).toFixed(4)} SOL
              </span>
            </h3>
            <button
              onClick={() =>
                allEmptySelected
                  ? dispatch({ type: "DESELECT_ALL_EMPTY" })
                  : dispatch({
                      type: "SELECT_ALL_EMPTY",
                      pubkeys: emptyAccounts.map((a) => a.pubkey.toBase58()),
                    })
              }
              className="flex items-center gap-2 border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 font-semibold text-xs shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-100 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Checkbox checked={allEmptySelected} />
              {allEmptySelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {emptyAccounts.map((account) => {
              const key = account.pubkey.toBase58();
              const isSelected = selectedEmpty.has(key);
              return (
                <button
                  key={key}
                  onClick={() =>
                    dispatch({ type: "TOGGLE_EMPTY", pubkey: key })
                  }
                  className={`w-full text-left border-3 p-4 transition-all cursor-pointer flex items-center gap-4 ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-brutal-sm"
                      : "border-[var(--border)] bg-white hover:bg-gray-50"
                  }`}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate font-medium">
                      {key}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Mint: {account.mint.slice(0, 8)}...
                      {account.mint.slice(-8)}
                    </p>
                  </div>
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
        </div>
      )}

      {/* Claim button */}
      <div className="border-3 border-[var(--border)] bg-white shadow-brutal-sm px-6 py-5">
        {claimError && (
          <div className="border-2 border-red-400 bg-red-50 p-3 mb-4">
            <p className="text-red-600 text-sm font-medium">{claimError}</p>
          </div>
        )}

        {isClaiming && progress.total > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm font-medium">
              Sending transaction {progress.current} of {progress.total}...
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)] max-w-sm">
            This will sign with both wallets and send the recovery transactions.
          </p>
          <button
            onClick={onProceed}
            disabled={!hasSelections || isClaiming}
            className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-10 py-3 font-bold text-base shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {isClaiming && (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isClaiming ? "Claiming..." : "Claim Selected"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
        checked
          ? "bg-[var(--accent)] border-[var(--accent)]"
          : "border-[var(--border)] bg-white"
      }`}
    >
      {checked && (
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
  );
}
