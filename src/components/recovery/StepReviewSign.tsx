"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import type { Adapter, SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { useState, useCallback } from "react";
import { TokenAccountInfo } from "@/hooks/useAllTokenAccounts";
import { useRecoveryTransactions } from "@/hooks/useRecoveryTransactions";

const RENT_PER_ACCOUNT = 0.00203928;

interface Props {
  compromisedPublicKey: PublicKey;
  compromisedAdapter: Adapter | null;
  fundingPublicKey: PublicKey;
  selectedTokenAccounts: TokenAccountInfo[];
  selectedEmptyAccounts: TokenAccountInfo[];
  onBack: () => void;
  onComplete: (results: { success: number; failed: number }) => void;
  results: { success: number; failed: number } | null;
}

type SignState =
  | "REVIEW"
  | "BUILDING"
  | "SIGNING_COMPROMISED"
  | "SENDING"
  | "DONE";

export function StepReviewSign({
  compromisedPublicKey,
  compromisedAdapter,
  fundingPublicKey,
  selectedTokenAccounts,
  selectedEmptyAccounts,
  onBack,
  onComplete,
  results,
}: Props) {
  const { sendTransaction } = useWallet();
  const { buildTransactions, connection } = useRecoveryTransactions();
  const [signState, setSignState] = useState<SignState>(
    results ? "DONE" : "REVIEW"
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const totalRent = selectedEmptyAccounts.length * RENT_PER_ACCOUNT;

  const handleSignAndSend = useCallback(async () => {
    if (!compromisedAdapter) {
      setError(
        "Compromised wallet adapter not available. Please go back and restart the process."
      );
      return;
    }

    setError(null);

    try {
      // Step 1: Build transactions
      setSignState("BUILDING");
      const txs = await buildTransactions(
        compromisedPublicKey,
        fundingPublicKey,
        selectedTokenAccounts,
        selectedEmptyAccounts
      );

      setProgress({ current: 0, total: txs.length });

      // Step 2: Sign with compromised wallet
      setSignState("SIGNING_COMPROMISED");
      const signedTxs: Transaction[] = [];

      if (!("signTransaction" in compromisedAdapter) || typeof (compromisedAdapter as SignerWalletAdapter).signTransaction !== "function") {
        setError("Compromised wallet does not support transaction signing.");
        setSignState("REVIEW");
        return;
      }

      const signer = compromisedAdapter as SignerWalletAdapter;
      for (const tx of txs) {
        const signed = await signer.signTransaction(tx);
        signedTxs.push(signed);
      }

      // Step 3: Send with funding wallet
      setSignState("SENDING");
      let success = 0;
      let failed = 0;

      for (let i = 0; i < signedTxs.length; i++) {
        setProgress({ current: i + 1, total: signedTxs.length });

        try {
          console.log(signedTxs[i].serialize().toString('base64'));
          const signature = await sendTransaction(
            signedTxs[i],
            connection
          );

          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash();

          await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );

          // Count accounts in this batch
          const tokenCount = Math.min(
            selectedTokenAccounts.length - i * 5,
            5
          );
          const emptyCount = Math.min(
            selectedEmptyAccounts.length - i * 15,
            15
          );
          success += Math.max(0, tokenCount) + Math.max(0, emptyCount);
        } catch (err) {
          console.log("Transaction failed:", err);
          failed++;
          console.error("Unexpected error:", error);
          if(err instanceof SendTransactionError){
            const logs = await err.getLogs(connection);
            console.error("Transaction failed with logs:", logs);
          }
        }
      }

      setSignState("DONE");
      onComplete({ success: signedTxs.length - failed, failed });
    } catch (err) {
      console.log("Recovery error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setSignState("REVIEW");
    }
  }, [
    compromisedAdapter,
    compromisedPublicKey,
    fundingPublicKey,
    selectedTokenAccounts,
    selectedEmptyAccounts,
    buildTransactions,
    connection,
    sendTransaction,
    onComplete,
  ]);

  return (
    <div className="space-y-8">
      {/* Step indicator + back */}
      <div className="flex items-center gap-3">
        {signState === "REVIEW" && (
          <button
            onClick={onBack}
            className="w-8 h-8 border-2 border-[var(--border)] flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-brutal-sm active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        )}
        <span className="w-7 h-7 border-2 border-[var(--border)] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
          3
        </span>
        <h2 className="text-lg font-bold">Review & Sign</h2>
      </div>

      {/* Transaction summary */}
      <div className="border-3 border-[var(--border)] bg-white shadow-brutal">
        <div className="px-6 py-5 border-b-2 border-dashed border-gray-200">
          <h3 className="font-bold text-base mb-4">Transaction Summary</h3>

          <div className="space-y-3">
            {/* Wallets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border-2 border-[var(--border)] p-3 bg-[var(--bg)]">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">
                  From (Compromised)
                </p>
                <p className="font-mono text-xs truncate">
                  {compromisedPublicKey.toBase58()}
                </p>
              </div>
              <div className="border-2 border-[var(--border)] p-3 bg-[var(--bg)]">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">
                  To (Funding / Safe)
                </p>
                <p className="font-mono text-xs truncate">
                  {fundingPublicKey.toBase58()}
                </p>
              </div>
            </div>

            {/* What's being recovered */}
            <div className="border-2 border-dashed border-gray-300 p-4 space-y-2">
              {selectedTokenAccounts.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--muted)]">
                    Token accounts to transfer
                  </span>
                  <span className="font-bold">
                    {selectedTokenAccounts.length}
                  </span>
                </div>
              )}
              {selectedEmptyAccounts.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--muted)]">
                    Empty accounts to close
                  </span>
                  <span className="font-bold">
                    {selectedEmptyAccounts.length}
                  </span>
                </div>
              )}
              {selectedEmptyAccounts.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-[var(--muted)]">
                    Rent to reclaim
                  </span>
                  <span className="font-bold text-[var(--accent)]">
                    {totalRent.toFixed(6)} SOL
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm text-[var(--muted)]">
                  Gas paid by funding wallet
                </span>
                <span className="text-sm font-medium">~0.000005 SOL / tx</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action area */}
        <div className="px-6 py-5">
          {/* Error */}
          {error && (
            <div className="border-2 border-red-400 bg-red-50 p-4 mb-4">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* State-dependent content */}
          {signState === "REVIEW" && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Clicking the button below will first ask your{" "}
                <strong>compromised wallet</strong> to sign, then your{" "}
                <strong>funding wallet</strong> will send the transaction.
              </p>
              <button
                onClick={handleSignAndSend}
                className="w-full border-2 border-[var(--border)] bg-[var(--accent)] text-white px-8 py-3.5 font-bold text-base shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Sign & Send Transactions
              </button>
            </div>
          )}

          {signState === "BUILDING" && (
            <ProgressIndicator
              label="Building transactions..."
              sub="Preparing instructions"
            />
          )}

          {signState === "SIGNING_COMPROMISED" && (
            <ProgressIndicator
              label="Approve in compromised wallet"
              sub="Check your wallet extension for a signing request"
            />
          )}

          {signState === "SENDING" && (
            <ProgressIndicator
              label={`Sending transaction ${progress.current} of ${progress.total}...`}
              sub="Your funding wallet is submitting the transactions"
            />
          )}

          {signState === "DONE" && results && (
            <div className="space-y-3">
              {results.success > 0 && (
                <div className="border-2 border-green-400 bg-green-50 p-4">
                  <p className="font-bold text-green-700">
                    {results.success} transaction
                    {results.success > 1 ? "s" : ""} succeeded!
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Tokens and rent have been sent to your funding wallet.
                  </p>
                </div>
              )}
              {results.failed > 0 && (
                <div className="border-2 border-yellow-400 bg-yellow-50 p-4">
                  <p className="font-bold text-yellow-700">
                    {results.failed} transaction
                    {results.failed > 1 ? "s" : ""} failed.
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    You can try again for the failed transactions.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressIndicator({
  label,
  sub,
}: {
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs text-[var(--muted)]">{sub}</p>
      </div>
    </div>
  );
}
