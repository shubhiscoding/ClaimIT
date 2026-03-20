"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useCallback, useEffect, useMemo, useState } from "react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export interface EmptyTokenAccount {
  pubkey: PublicKey;
  mint: string;
}

export function useEmptyTokenAccounts() {
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);
  const { publicKey } = useWallet();
  const [accounts, setAccounts] = useState<EmptyTokenAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!publicKey) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const empty: EmptyTokenAccount[] = [];

      for (const { pubkey, account } of tokenAccounts.value) {
        // Token account data layout: mint (32 bytes), owner (32 bytes), amount (8 bytes at offset 64)
        const data = account.data;
        const amount = data.readBigUInt64LE(64);
        if (amount === 0n) {
          const mint = new PublicKey(data.subarray(0, 32));
          empty.push({ pubkey, mint: mint.toBase58() });
        }
      }

      setAccounts(empty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch token accounts");
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, loading, error, refetch: fetchAccounts };
}
