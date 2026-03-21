"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAssetMetadata } from "./useAllTokenAccounts";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export interface EmptyTokenAccount {
  pubkey: PublicKey;
  mint: string;
  name: string | null;
  symbol: string | null;
  image: string | null;
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

      const rawEmpty: { pubkey: PublicKey; mint: string }[] = [];

      for (const { pubkey, account } of tokenAccounts.value) {
        const data = account.data;
        const amount = data.readBigUInt64LE(64);
        if (amount === 0n) {
          const mint = new PublicKey(data.subarray(0, 32));
          rawEmpty.push({ pubkey, mint: mint.toBase58() });
        }
      }

      // Fetch metadata for all unique mints
      const uniqueMints = [...new Set(rawEmpty.map((e) => e.mint))];
      const metadataMap = await fetchAssetMetadata(uniqueMints);

      const empty: EmptyTokenAccount[] = rawEmpty.map((entry) => {
        const meta = metadataMap.get(entry.mint);
        return {
          ...entry,
          name: meta?.name ?? null,
          symbol: meta?.symbol ?? null,
          image: meta?.image ?? null,
        };
      });

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
