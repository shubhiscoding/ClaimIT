"use client";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
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

// Token accounts need 3 instructions each (ATA + transfer + close)
// Empty accounts need 1 instruction each (close)
// Safe limit: ~15 instructions per tx
const MAX_INSTRUCTIONS_PER_TX = 15;

export function useRecoveryTransactions() {
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);

  const buildTransactions = useCallback(
    async (
      compromisedPubkey: PublicKey,
      fundingPubkey: PublicKey,
      selectedTokenAccounts: TokenAccountInfo[],
      selectedEmptyAccounts: TokenAccountInfo[]
    ): Promise<Transaction[]> => {
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

      for (const group of groups) {
        if (
          currentCount + group.instructionCount > MAX_INSTRUCTIONS_PER_TX &&
          currentBatch.length > 0
        ) {
          transactions.push(
            await buildSingleTransaction(
              connection,
              compromisedPubkey,
              fundingPubkey,
              currentBatch
            )
          );
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
            currentBatch
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
  groups: { type: "token" | "empty"; account: TokenAccountInfo }[]
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

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = fundingPubkey;

  return tx;
}
