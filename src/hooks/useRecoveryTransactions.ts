"use client";

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { useMemo, useCallback } from "react";
import { TokenAccountInfo } from "./useAllTokenAccounts";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET ||
    "91ehp7vjpAic1KAYgK9TSrS5m599dg7nbbEfZrMzqGEw"
);

const SOL_MINT = "So11111111111111111111111111111111111111112";
const FEE_PERCENT = 0.1; // 10%
const MIN_FEE_LAMPORTS = 100_000; // 0.0001 SOL

// Token accounts need 3 instructions each (ATA + transfer + close)
// Empty accounts need 1 instruction each (close)
// +1 for the fee transfer instruction
// Safe limit: ~15 instructions per tx
const MAX_INSTRUCTIONS_PER_TX = 15;

/**
 * Fetch SOL value of tokens via Jupiter quote API.
 * Returns total lamports value of all token transfers combined.
 */
async function getTokensSolValue(
  tokenAccounts: TokenAccountInfo[]
): Promise<bigint> {
  if (tokenAccounts.length === 0) return 0n;

  let totalLamports = 0n;

  // Batch quotes — Jupiter allows one quote at a time, so we run them in parallel
  const quotePromises = tokenAccounts.map(async (account) => {
    try {
      const res = await fetch(
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${account.mint}&outputMint=${SOL_MINT}&amount=${account.amount.toString()}&swapMode=ExactIn`
      );
      if (!res.ok) return 0n;
      const data = await res.json();
      return BigInt(data.outAmount ?? "0");
    } catch {
      return 0n;
    }
  });

  const results = await Promise.all(quotePromises);
  for (const lamports of results) {
    totalLamports += lamports;
  }

  return totalLamports;
}

export function useRecoveryTransactions() {
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);

  const buildTransactions = useCallback(
    async (
      compromisedPubkey: PublicKey,
      fundingPubkey: PublicKey,
      selectedTokenAccounts: TokenAccountInfo[],
      selectedEmptyAccounts: TokenAccountInfo[]
    ): Promise<Transaction[]> => {
      // Calculate fee from token values
      const hasAccounts =
        selectedTokenAccounts.length > 0 || selectedEmptyAccounts.length > 0;
      const tokenSolValue = await getTokensSolValue(selectedTokenAccounts);
      const rawFee =
        (tokenSolValue * BigInt(Math.round(FEE_PERCENT * 1000))) / 1000n;
      const totalFee =
        hasAccounts && rawFee < BigInt(MIN_FEE_LAMPORTS)
          ? BigInt(MIN_FEE_LAMPORTS)
          : rawFee;
      const transactions: Transaction[] = [];

      // Build instruction groups
      type InstructionGroup = {
        type: "token" | "empty";
        account: TokenAccountInfo;
        instructionCount: number;
      };

      const groups: InstructionGroup[] = [];

      for (const account of selectedTokenAccounts) {
        groups.push({ type: "token", account, instructionCount: 3 });
      }
      for (const account of selectedEmptyAccounts) {
        groups.push({ type: "empty", account, instructionCount: 1 });
      }

      // Batch into transactions by instruction count
      let currentBatch: InstructionGroup[] = [];
      let currentCount = 0;
      let feeAdded = false;

      for (const group of groups) {
        // Reserve 1 instruction slot for fee in the first tx
        const feeSlot = !feeAdded && totalFee > 0n ? 1 : 0;
        if (
          currentCount + group.instructionCount + feeSlot >
            MAX_INSTRUCTIONS_PER_TX &&
          currentBatch.length > 0
        ) {
          transactions.push(
            await buildSingleTransaction(
              connection,
              compromisedPubkey,
              fundingPubkey,
              currentBatch,
              !feeAdded ? totalFee : 0n
            )
          );
          if (!feeAdded && totalFee > 0n) feeAdded = true;
          currentBatch = [];
          currentCount = 0;
        }
        currentBatch.push(group);
        currentCount += group.instructionCount;
      }

      if (currentBatch.length > 0) {
        transactions.push(
          await buildSingleTransaction(
            connection,
            compromisedPubkey,
            fundingPubkey,
            currentBatch,
            !feeAdded ? totalFee : 0n
          )
        );
      }
      return transactions;
    },
    [connection]
  );

  return { buildTransactions, connection };
}

async function buildSingleTransaction(
  connection: Connection,
  compromisedPubkey: PublicKey,
  fundingPubkey: PublicKey,
  groups: { type: "token" | "empty"; account: TokenAccountInfo }[],
  feeLamports: bigint
): Promise<Transaction> {
  const tx = new Transaction();

  for (const { type, account } of groups) {
    if (type === "token") {
      const mint = new PublicKey(account.mint);
      const fundingAta = getAssociatedTokenAddressSync(mint, fundingPubkey);

      // Create ATA on funding wallet (idempotent - no-op if exists)
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          fundingPubkey,
          fundingAta,
          fundingPubkey,
          mint
        )
      );

      // Transfer all tokens to funding wallet's ATA
      tx.add(
        createTransferInstruction(
          account.pubkey,
          fundingAta,
          compromisedPubkey,
          account.amount
        )
      );

      // Close the now-empty account, rent goes to funding wallet
      tx.add(
        createCloseAccountInstruction(
          account.pubkey,
          fundingPubkey,
          compromisedPubkey
        )
      );
    } else {
      // Empty account - just close it
      tx.add(
        createCloseAccountInstruction(
          account.pubkey,
          fundingPubkey,
          compromisedPubkey
        )
      );
    }
  }

  // Add fee transfer from funding wallet to treasury
  if (feeLamports > 0n) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: fundingPubkey,
        toPubkey: TREASURY_WALLET,
        lamports: feeLamports,
      })
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = fundingPubkey;

  return tx;
}
