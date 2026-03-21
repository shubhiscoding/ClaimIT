"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useReducer, useCallback, useRef, useState, useEffect } from "react";
import {
  useAllTokenAccounts,
  TokenAccountInfo,
  fetchFundingMints,
} from "@/hooks/useAllTokenAccounts";
import { useRecoveryTransactions } from "@/hooks/useRecoveryTransactions";
import { SummaryBar } from "./SummaryBar";
import { StepSelectAccounts } from "./StepSelectAccounts";

// ── Types ──

export type RecoveryStep =
  | "CONNECT_COMPROMISED"
  | "CONNECT_FUNDING"
  | "SELECT"
  | "SIGN_FUNDING"
  | "SWITCH_TO_COMPROMISED"
  | "SIGN_COMPROMISED"
  | "DONE";

interface FundingWalletData {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

interface RecoveryState {
  step: RecoveryStep;
  compromisedPublicKey: PublicKey | null;
  selectedTokens: Set<string>;
  selectedEmpty: Set<string>;
  results: { success: number; failed: number; signatures: string[] } | null;
}

type Action =
  | { type: "SET_STEP"; step: RecoveryStep }
  | { type: "SET_COMPROMISED"; publicKey: PublicKey }
  | { type: "TOGGLE_TOKEN"; pubkey: string }
  | { type: "TOGGLE_EMPTY"; pubkey: string }
  | { type: "SELECT_ALL_TOKENS"; pubkeys: string[] }
  | { type: "DESELECT_ALL_TOKENS" }
  | { type: "SELECT_ALL_EMPTY"; pubkeys: string[] }
  | { type: "DESELECT_ALL_EMPTY" }
  | {
      type: "SET_RESULTS";
      results: { success: number; failed: number; signatures: string[] };
    }
  | { type: "RESET" };

function reducer(state: RecoveryState, action: Action): RecoveryState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_COMPROMISED":
      return { ...state, compromisedPublicKey: action.publicKey };
    case "TOGGLE_TOKEN": {
      const next = new Set(state.selectedTokens);
      if (next.has(action.pubkey)) next.delete(action.pubkey);
      else next.add(action.pubkey);
      return { ...state, selectedTokens: next };
    }
    case "TOGGLE_EMPTY": {
      const next = new Set(state.selectedEmpty);
      if (next.has(action.pubkey)) next.delete(action.pubkey);
      else next.add(action.pubkey);
      return { ...state, selectedEmpty: next };
    }
    case "SELECT_ALL_TOKENS":
      return { ...state, selectedTokens: new Set(action.pubkeys) };
    case "DESELECT_ALL_TOKENS":
      return { ...state, selectedTokens: new Set() };
    case "SELECT_ALL_EMPTY":
      return { ...state, selectedEmpty: new Set(action.pubkeys) };
    case "DESELECT_ALL_EMPTY":
      return { ...state, selectedEmpty: new Set() };
    case "SET_RESULTS":
      return { ...state, results: action.results, step: "DONE" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: RecoveryState = {
  step: "CONNECT_COMPROMISED",
  compromisedPublicKey: null,
  selectedTokens: new Set(),
  selectedEmpty: new Set(),
  results: null,
};

// ── Persistence helpers ──

const STORAGE_KEY = "claimit_recovery_wallets";

function saveWallets(compromised: string, funding: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ compromised, funding })
    );
  } catch {}
}

function loadWallets(): { compromised: string; funding: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.compromised && parsed.funding) return parsed;
  } catch {}
  return null;
}

function clearWallets() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ── Component ──

export function FundRecoveryFlow() {
  const { publicKey, signTransaction, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { buildTransactions, connection } = useRecoveryTransactions();

  // Ref to hold the funding wallet's data
  const fundingWalletRef = useRef<FundingWalletData | null>(null);

  // Transactions being processed
  const builtTxsRef = useRef<Transaction[]>([]);
  const fundingSignedTxsRef = useRef<Transaction[]>([]);

  const [claimError, setClaimError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fundingMints, setFundingMints] = useState<Set<string>>(new Set());

  // ── Restore from localStorage on mount ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = loadWallets();
    if (!saved) return;

    try {
      const compromisedPk = new PublicKey(saved.compromised);
      const fundingPk = new PublicKey(saved.funding);

      dispatch({ type: "SET_COMPROMISED", publicKey: compromisedPk });

      // If the currently connected wallet matches the funding wallet, lock it in
      if (
        publicKey &&
        signTransaction &&
        publicKey.toBase58() === saved.funding
      ) {
        fundingWalletRef.current = { publicKey: fundingPk, signTransaction };
        dispatch({ type: "SET_STEP", step: "SELECT" });

        // Fetch funding mints
        fetchFundingMints(fundingPk)
          .then(setFundingMints)
          .catch(() => {});
      } else {
        // User needs to connect funding wallet — we know the compromised wallet
        dispatch({ type: "SET_STEP", step: "CONNECT_FUNDING" });
      }
    } catch {
      clearWallets();
    }
  }, [publicKey, signTransaction]);

  // Fetch accounts for the compromised wallet
  const {
    tokenAccounts,
    emptyAccounts,
    loading: accountsLoading,
    error: accountsError,
    refetch,
  } = useAllTokenAccounts(state.compromisedPublicKey);

  // ── Step 1: Lock in compromised wallet ──
  const handleLockCompromised = useCallback(() => {
    if (!publicKey) return;
    dispatch({ type: "SET_COMPROMISED", publicKey });
    dispatch({ type: "SET_STEP", step: "CONNECT_FUNDING" });
  }, [publicKey]);

  // ── Step 2: Lock in funding wallet ──
  const handleLockFunding = useCallback(async () => {
    if (!publicKey || !signTransaction || !state.compromisedPublicKey) return;
    if (publicKey.toBase58() === state.compromisedPublicKey.toBase58()) return;

    fundingWalletRef.current = { publicKey, signTransaction };

    // Persist both wallets
    saveWallets(
      state.compromisedPublicKey.toBase58(),
      publicKey.toBase58()
    );

    // Fetch funding mints
    try {
      const mints = await fetchFundingMints(publicKey);
      setFundingMints(mints);
    } catch (err) {
      console.error("Failed to fetch funding wallet mints:", err);
    }

    dispatch({ type: "SET_STEP", step: "SELECT" });
  }, [publicKey, signTransaction, state.compromisedPublicKey]);

  // ── Derived data ──
  const selectedTokenAccountsList: TokenAccountInfo[] = tokenAccounts.filter(
    (a) => state.selectedTokens.has(a.pubkey.toBase58())
  );
  const selectedEmptyAccountsList: TokenAccountInfo[] = emptyAccounts.filter(
    (a) => state.selectedEmpty.has(a.pubkey.toBase58())
  );

  const hasSelections =
    state.selectedTokens.size > 0 || state.selectedEmpty.size > 0;

  // ── Step 3: User clicks "Claim" → build txs → sign with funding (already connected) ──
  const handleClaim = useCallback(async () => {
    if (!fundingWalletRef.current || !state.compromisedPublicKey) return;

    setClaimError(null);

    try {
      const txs = await buildTransactions(
        state.compromisedPublicKey,
        fundingWalletRef.current.publicKey,
        selectedTokenAccountsList,
        selectedEmptyAccountsList
      );

      builtTxsRef.current = txs;
      fundingSignedTxsRef.current = [];
      // Funding wallet should already be connected — go straight to signing
      dispatch({ type: "SET_STEP", step: "SIGN_FUNDING" });
    } catch (err) {
      console.error("Build error:", err);
      setClaimError(
        err instanceof Error ? err.message : "Failed to build transactions"
      );
    }
  }, [
    state.compromisedPublicKey,
    buildTransactions,
    selectedTokenAccountsList,
    selectedEmptyAccountsList,
  ]);

  // ── Auto-sign with funding wallet ──
  const fundingSignTriggered = useRef(false);
  useEffect(() => {
    if (state.step !== "SIGN_FUNDING") return;
    if (fundingSignTriggered.current) return;
    if (!signTransaction || !publicKey || !fundingWalletRef.current) return;
    if (
      publicKey.toBase58() !== fundingWalletRef.current.publicKey.toBase58()
    )
      return;

    fundingSignTriggered.current = true;

    (async () => {
      try {
        const signed: Transaction[] = [];
        for (const tx of builtTxsRef.current) {
          const s = await signTransaction(tx);
          signed.push(s);
        }
        fundingSignedTxsRef.current = signed;
        fundingSignTriggered.current = false;
        dispatch({ type: "SET_STEP", step: "SWITCH_TO_COMPROMISED" });
      } catch (err) {
        console.error("Funding sign error:", err);
        fundingSignTriggered.current = false;
        setClaimError(
          err instanceof Error
            ? err.message
            : "Funding wallet rejected signing"
        );
        dispatch({ type: "SET_STEP", step: "SELECT" });
      }
    })();
  }, [state.step, signTransaction, publicKey]);

  // ── Detect switch to compromised wallet ──
  useEffect(() => {
    if (state.step !== "SWITCH_TO_COMPROMISED") return;
    if (!publicKey || !state.compromisedPublicKey) return;

    if (publicKey.toBase58() === state.compromisedPublicKey.toBase58()) {
      dispatch({ type: "SET_STEP", step: "SIGN_COMPROMISED" });
    }
  }, [publicKey, state.step, state.compromisedPublicKey]);

  // ── Auto-sign with compromised wallet, then send ──
  const compromisedSignTriggered = useRef(false);
  useEffect(() => {
    if (state.step !== "SIGN_COMPROMISED") return;
    if (compromisedSignTriggered.current) return;
    if (!signTransaction || !publicKey || !state.compromisedPublicKey) return;
    if (publicKey.toBase58() !== state.compromisedPublicKey.toBase58()) return;

    compromisedSignTriggered.current = true;

    (async () => {
      try {
        setIsSending(true);
        setProgress({ current: 0, total: fundingSignedTxsRef.current.length });

        const fullySigned: Transaction[] = [];
        for (const tx of fundingSignedTxsRef.current) {
          const s = await signTransaction(tx);
          fullySigned.push(s);
        }

        // Send all fully signed transactions
        let success = 0;
        let failed = 0;
        const signatures: string[] = [];

        for (let i = 0; i < fullySigned.length; i++) {
          setProgress({ current: i + 1, total: fullySigned.length });

          try {
            const rawTx = fullySigned[i].serialize();
            const signature = await connection.sendRawTransaction(rawTx);

            const { blockhash, lastValidBlockHeight } =
              await connection.getLatestBlockhash();

            await connection.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight },
              "confirmed"
            );

            signatures.push(signature);
            success++;
          } catch (err) {
            console.error(`Transaction ${i + 1} failed:`, err);
            failed++;
          }
        }

        compromisedSignTriggered.current = false;
        dispatch({
          type: "SET_RESULTS",
          results: { success, failed, signatures },
        });
      } catch (err) {
        console.error("Compromised sign error:", err);
        compromisedSignTriggered.current = false;
        setClaimError(
          err instanceof Error
            ? err.message
            : "Compromised wallet rejected signing"
        );
        dispatch({ type: "SET_STEP", step: "SELECT" });
      } finally {
        setIsSending(false);
      }
    })();
  }, [
    state.step,
    signTransaction,
    publicKey,
    state.compromisedPublicKey,
    connection,
  ]);

  // ── Back navigation ──
  const handleBack = useCallback(() => {
    switch (state.step) {
      case "CONNECT_FUNDING":
        dispatch({ type: "RESET" });
        clearWallets();
        break;
      case "SELECT":
        // Go back to connect funding — clear funding ref
        fundingWalletRef.current = null;
        setFundingMints(new Set());
        clearWallets();
        dispatch({ type: "SET_STEP", step: "CONNECT_FUNDING" });
        break;
      case "SIGN_FUNDING":
      case "SWITCH_TO_COMPROMISED":
        // Go back to selection
        builtTxsRef.current = [];
        fundingSignedTxsRef.current = [];
        fundingSignTriggered.current = false;
        dispatch({ type: "SET_STEP", step: "SELECT" });
        break;
      case "DONE":
        // Go back to selection to try again
        builtTxsRef.current = [];
        fundingSignedTxsRef.current = [];
        fundingSignTriggered.current = false;
        compromisedSignTriggered.current = false;
        dispatch({ type: "SET_STEP", step: "SELECT" });
        break;
      default:
        break;
    }
  }, [state.step]);

  // ── Render ──

  const fundingAddr = fundingWalletRef.current?.publicKey.toBase58();
  const shortFunding = fundingAddr
    ? `${fundingAddr.slice(0, 4)}...${fundingAddr.slice(-4)}`
    : "";
  const compromisedAddr = state.compromisedPublicKey?.toBase58();
  const shortCompromised = compromisedAddr
    ? `${compromisedAddr.slice(0, 4)}...${compromisedAddr.slice(-4)}`
    : "";

  // Steps that can go back
  const canGoBack =
    state.step === "CONNECT_FUNDING" ||
    state.step === "SELECT" ||
    state.step === "SIGN_FUNDING" ||
    state.step === "SWITCH_TO_COMPROMISED" ||
    state.step === "DONE";

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
      {/* Summary bar */}
      {state.compromisedPublicKey && (
        <SummaryBar
          compromisedPublicKey={state.compromisedPublicKey}
          fundingPublicKey={fundingWalletRef.current?.publicKey ?? null}
          tokenAccounts={tokenAccounts}
          emptyAccounts={emptyAccounts}
          selectedTokens={state.selectedTokens}
          selectedEmpty={state.selectedEmpty}
          loading={accountsLoading}
          fundingMints={fundingMints}
          onReset={() => {
            fundingWalletRef.current = null;
            clearWallets();
            dispatch({ type: "RESET" });
          }}
          onDisconnect={() => {
            fundingWalletRef.current = null;
            clearWallets();
            disconnect();
            dispatch({ type: "RESET" });
          }}
        />
      )}

      {/* ── Step 1: Connect Compromised Wallet ── */}
      {state.step === "CONNECT_COMPROMISED" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-red-50 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-black mb-3">
            Connect Compromised Wallet
          </h2>
          <p className="text-[var(--muted)] max-w-md mb-3 leading-relaxed">
            Start by connecting your <strong>compromised wallet</strong>. This
            is the wallet you want to recover funds from.
          </p>

          <div className="border-2 border-yellow-400 bg-yellow-50 p-4 max-w-md mb-8 text-left">
            <p className="text-sm text-yellow-700 leading-relaxed">
              <strong>Step 1 of 3:</strong> Connect your compromised wallet
              first. You&apos;ll switch to the funding wallet next.
            </p>
          </div>

          {publicKey ? (
            <div className="space-y-4">
              <div className="border-2 border-[var(--border)] bg-white p-4 shadow-brutal-sm">
                <p className="text-xs text-[var(--muted)] mb-1">
                  Connected wallet
                </p>
                <p className="font-mono text-sm">{publicKey.toBase58()}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLockCompromised}
                  className="border-2 border-[var(--border)] bg-red-500 text-white px-8 py-3 font-bold text-lg shadow-brutal-sm transition-all cursor-pointer hover:bg-red-600 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  Lock in as Compromised Wallet
                </button>
                <button
                  onClick={disconnect}
                  className="border-2 border-[var(--border)] bg-white px-4 py-3 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-8 py-3 font-bold text-lg shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* ── Step 2: Connect Funding Wallet ── */}
      {state.step === "CONNECT_FUNDING" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-green-50 border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-black mb-3">Connect Funding Wallet</h2>
          <p className="text-[var(--muted)] max-w-md mb-3 leading-relaxed">
            Now switch to your <strong>safe wallet</strong>. This wallet will
            pay gas fees and receive all recovered tokens and rent.
          </p>

          <div className="border-2 border-yellow-400 bg-yellow-50 p-4 max-w-md mb-4 text-left">
            <p className="text-sm text-yellow-700 leading-relaxed">
              <strong>Step 2 of 3:</strong> Connect your safe funding wallet.
              You&apos;ll select accounts to recover next.
            </p>
          </div>

          <div className="border-2 border-red-200 bg-red-50 p-3 max-w-md mb-8 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <p className="text-xs font-bold text-red-700">
                Compromised wallet locked
              </p>
            </div>
            <p className="font-mono text-xs text-red-600">
              {state.compromisedPublicKey?.toBase58()}
            </p>
          </div>

          {publicKey &&
          state.compromisedPublicKey &&
          publicKey.toBase58() !==
            state.compromisedPublicKey.toBase58() ? (
            <div className="space-y-4">
              <div className="border-2 border-[var(--border)] bg-white p-4 shadow-brutal-sm">
                <p className="text-xs text-[var(--muted)] mb-1">
                  Connected wallet
                </p>
                <p className="font-mono text-sm">{publicKey.toBase58()}</p>
              </div>
              <button
                onClick={handleLockFunding}
                className="border-2 border-[var(--border)] bg-[var(--accent)] text-white px-8 py-3 font-bold text-lg shadow-brutal-sm transition-all cursor-pointer hover:bg-[var(--accent-hover)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                Lock in as Funding Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-[var(--border)] bg-white p-5 shadow-brutal-sm max-w-md">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-bold text-sm">
                      Waiting for a different wallet...
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Switch to your funding wallet in the wallet extension
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleBack}
              className="border-2 border-[var(--border)] bg-white px-5 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Select Accounts ── */}
      {state.step === "SELECT" && (
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 border-2 border-[var(--border)] bg-white px-4 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Change Wallets
          </button>
          <StepSelectAccounts
            tokenAccounts={tokenAccounts}
            emptyAccounts={emptyAccounts}
            selectedTokens={state.selectedTokens}
            selectedEmpty={state.selectedEmpty}
            dispatch={dispatch}
            loading={accountsLoading}
            error={accountsError}
            refetch={refetch}
            hasSelections={hasSelections}
            onProceed={handleClaim}
            isClaiming={false}
            claimError={claimError}
            progress={{ current: 0, total: 0 }}
            fundingMints={fundingMints}
          />
        </div>
      )}

      {/* ── Signing with Funding Wallet ── */}
      {state.step === "SIGN_FUNDING" && (
        <div>
          <SigningPrompt
            title="Approve in Funding Wallet"
            description="Your funding wallet extension should show a signing request. Please approve it."
            walletLabel="Funding"
            walletAddress={shortFunding}
            txCount={builtTxsRef.current.length}
          />
          <div className="flex justify-center mt-4">
            <button
              onClick={handleBack}
              className="border-2 border-[var(--border)] bg-white px-5 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back to Selection
            </button>
          </div>
        </div>
      )}

      {/* ── Switch to Compromised Wallet for second sign ── */}
      {state.step === "SWITCH_TO_COMPROMISED" && (
        <div>
          <WalletSwitchPrompt
            title="Switch to Compromised Wallet"
            description={`Switch your wallet to the compromised wallet (${shortCompromised}). It needs to authorize the transfers.`}
            targetLabel={`Waiting for ${shortCompromised}...`}
            currentPublicKey={publicKey}
            lockedWallet={{
              label: "Target wallet",
              address: compromisedAddr ?? "",
              color: "red",
            }}
          />
          <div className="flex justify-center mt-4">
            <button
              onClick={handleBack}
              className="border-2 border-[var(--border)] bg-white px-5 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back to Selection
            </button>
          </div>
        </div>
      )}

      {/* ── Signing with Compromised Wallet + Sending ── */}
      {state.step === "SIGN_COMPROMISED" && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
          {!isSending ? (
            <SigningPrompt
              title="Approve in Compromised Wallet"
              description="Your compromised wallet extension should show a signing request. Please approve it."
              walletLabel="Compromised"
              walletAddress={shortCompromised}
              txCount={fundingSignedTxsRef.current.length}
            />
          ) : (
            <div className="border-3 border-[var(--border)] bg-white p-8 shadow-brutal max-w-md w-full">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="text-left">
                  <p className="font-bold">
                    Sending transaction {progress.current} of {progress.total}
                    ...
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Submitting to the Solana network
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {state.step === "DONE" && state.results && (
        <div className="space-y-6">
          {state.results.success > 0 && (
            <div className="border-3 border-green-500 bg-green-50 p-6 shadow-brutal">
              <h3 className="text-xl font-black text-green-700 mb-2">
                Recovery Successful!
              </h3>
              <p className="text-green-600">
                {state.results.success} transaction
                {state.results.success > 1 ? "s" : ""} completed. Tokens and
                rent have been sent to your funding wallet.
              </p>
            </div>
          )}
          {state.results.signatures.length > 0 && (
            <div className="border-3 border-[var(--border)] bg-white p-6 shadow-brutal">
              <h4 className="font-bold text-sm uppercase tracking-wide text-[var(--muted)] mb-3">
                Transaction Hashes
              </h4>
              <div className="space-y-2">
                {state.results.signatures.map((sig, i) => (
                  <div
                    key={sig}
                    className="flex items-center gap-3 border-2 border-[var(--border)] bg-[var(--bg)] p-3"
                  >
                    <span className="text-xs font-bold text-[var(--muted)] w-6">
                      {i + 1}.
                    </span>
                    <a
                      href={`https://solscan.io/tx/${sig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[var(--accent)] hover:underline truncate flex-1"
                    >
                      {sig}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(sig)}
                      className="border-2 border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold cursor-pointer hover:bg-gray-50 flex-shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {state.results.failed > 0 && (
            <div className="border-3 border-yellow-500 bg-yellow-50 p-6 shadow-brutal">
              <p className="font-bold text-yellow-700">
                {state.results.failed} transaction
                {state.results.failed > 1 ? "s" : ""} failed.
              </p>
              <p className="text-sm text-yellow-600 mt-1">
                You may need to restart the process for failed transactions.
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="border-2 border-[var(--border)] bg-white px-6 py-3 font-bold shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              Back to Selection
            </button>
            <button
              onClick={() => {
                fundingWalletRef.current = null;
                clearWallets();
                dispatch({ type: "RESET" });
              }}
              className="border-2 border-[var(--border)] bg-white px-6 py-3 font-bold shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Back button for steps without inline back */}
      {canGoBack &&
        state.step !== "CONNECT_FUNDING" &&
        state.step !== "SELECT" &&
        state.step !== "SIGN_FUNDING" &&
        state.step !== "SWITCH_TO_COMPROMISED" &&
        state.step !== "DONE" && (
          <div className="flex justify-center">
            <button
              onClick={handleBack}
              className="border-2 border-[var(--border)] bg-white px-5 py-2 font-semibold text-sm shadow-brutal-sm transition-all cursor-pointer hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back
            </button>
          </div>
        )}
    </div>
  );
}

// ── Reusable: Wallet Switch Prompt ──

function WalletSwitchPrompt({
  title,
  description,
  targetLabel,
  currentPublicKey,
  lockedWallet,
}: {
  title: string;
  description: string;
  targetLabel: string;
  currentPublicKey: PublicKey | null;
  lockedWallet: { label: string; address: string; color: "green" | "red" };
}) {
  const iconColor =
    lockedWallet.color === "green" ? "text-green-600" : "text-red-500";
  const bgColor =
    lockedWallet.color === "green" ? "bg-green-50" : "bg-red-50";
  const borderColor =
    lockedWallet.color === "green" ? "border-green-400" : "border-red-400";
  const dotColor =
    lockedWallet.color === "green" ? "bg-green-500" : "bg-red-500";
  const textColor =
    lockedWallet.color === "green" ? "text-green-700" : "text-red-700";
  const subColor =
    lockedWallet.color === "green" ? "text-green-600" : "text-red-600";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className={`w-20 h-20 ${bgColor} border-3 border-[var(--border)] shadow-brutal flex items-center justify-center mb-8`}
      >
        <svg
          className={`w-10 h-10 ${iconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </svg>
      </div>

      <h2 className="text-3xl font-black mb-3">{title}</h2>
      <p className="text-[var(--muted)] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {lockedWallet.address && (
        <div
          className={`border-2 ${borderColor} ${bgColor} p-4 max-w-md mb-6 text-left`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 ${dotColor} rounded-full`} />
            <p className={`text-xs font-bold ${textColor}`}>
              {lockedWallet.label}
            </p>
          </div>
          <p className={`font-mono text-xs ${subColor}`}>
            {lockedWallet.address}
          </p>
        </div>
      )}

      <div className="border-2 border-[var(--border)] bg-white p-5 shadow-brutal-sm max-w-md">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div className="text-left">
            <p className="font-bold text-sm">{targetLabel}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Current:{" "}
              <span className="font-mono">
                {currentPublicKey
                  ? `${currentPublicKey.toBase58().slice(0, 4)}...${currentPublicKey.toBase58().slice(-4)}`
                  : "disconnected"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable: Signing Prompt ──

function SigningPrompt({
  title,
  description,
  walletLabel,
  walletAddress,
  txCount,
}: {
  title: string;
  description: string;
  walletLabel: string;
  walletAddress: string;
  txCount: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="border-3 border-[var(--border)] bg-white p-8 shadow-brutal max-w-md w-full space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div className="text-left">
            <p className="font-bold">{title}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
          </div>
        </div>
        <div className="border-t-2 border-dashed border-gray-200 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">{walletLabel} wallet</span>
            <span className="font-mono text-xs">{walletAddress}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[var(--muted)]">Transactions</span>
            <span className="font-bold">{txCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
