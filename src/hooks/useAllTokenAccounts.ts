"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useCallback, useEffect, useMemo, useState } from "react";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export interface TokenAccountInfo {
  pubkey: PublicKey;
  mint: string;
  amount: bigint;
  decimals: number;
  uiAmount: number;
  name: string | null;
  symbol: string | null;
  image: string | null;
}

interface HeliusAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    files?: Array<{
      uri?: string;
      cdn_uri?: string;
      mime?: string;
    }>;
    links?: {
      image?: string;
    };
  };
}

export async function fetchAssetMetadata(
  mints: string[]
): Promise<Map<string, { name: string | null; symbol: string | null; image: string | null }>> {
  const metadataMap = new Map<string, { name: string | null; symbol: string | null; image: string | null }>();

  if (mints.length === 0) return metadataMap;

  try {
    // Batch in groups of 1000 (API limit)
    const batches: string[][] = [];
    for (let i = 0; i < mints.length; i += 1000) {
      batches.push(mints.slice(i, i + 1000));
    }

    for (const batch of batches) {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "get-asset-batch",
          method: "getAssetBatch",
          params: { ids: batch },
        }),
      });

      const data = await response.json();
      const results: HeliusAsset[] = data.result ?? [];

      for (const asset of results) {
        const name = asset.content?.metadata?.name ?? null;
        const symbol = asset.content?.metadata?.symbol ?? null;
        const image =
          asset.content?.links?.image ??
          asset.content?.files?.[0]?.cdn_uri ??
          asset.content?.files?.[0]?.uri ??
          null;

        metadataMap.set(asset.id, { name, symbol, image });
      }
    }
  } catch (err) {
    console.error("Failed to fetch asset metadata:", err);
  }

  return metadataMap;
}

export function useAllTokenAccounts(walletPublicKey: PublicKey | null) {
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccountInfo[]>([]);
  const [emptyAccounts, setEmptyAccounts] = useState<TokenAccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!walletPublicKey) {
      setTokenAccounts([]);
      setEmptyAccounts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const allEntries: {
        pubkey: PublicKey;
        mint: string;
        amount: bigint;
        decimals: number;
        uiAmount: number;
      }[] = [];

      for (const { pubkey, account } of response.value) {
        const parsed = account.data.parsed;
        const info = parsed.info;
        allEntries.push({
          pubkey,
          mint: info.mint,
          amount: BigInt(info.tokenAmount.amount),
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount ?? 0,
        });
      }

      // Fetch metadata for all unique mints
      const uniqueMints = [...new Set(allEntries.map((e) => e.mint))];
      const metadataMap = await fetchAssetMetadata(uniqueMints);

      const tokens: TokenAccountInfo[] = [];
      const empty: TokenAccountInfo[] = [];

      for (const entry of allEntries) {
        const meta = metadataMap.get(entry.mint);
        const full: TokenAccountInfo = {
          ...entry,
          name: meta?.name ?? null,
          symbol: meta?.symbol ?? null,
          image: meta?.image ?? null,
        };

        if (entry.amount > 0n) {
          tokens.push(full);
        } else {
          empty.push(full);
        }
      }

      setTokenAccounts(tokens);
      setEmptyAccounts(empty);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch token accounts"
      );
    } finally {
      setLoading(false);
    }
  }, [walletPublicKey, connection]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { tokenAccounts, emptyAccounts, loading, error, refetch: fetchAccounts };
}

/** Lightweight fetch — returns just the set of mint addresses a wallet already holds token accounts for. */
export async function fetchFundingMints(
  walletPublicKey: PublicKey
): Promise<Set<string>> {
  const connection = new Connection(RPC_URL, "confirmed");
  const response = await connection.getParsedTokenAccountsByOwner(
    walletPublicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const mints = new Set<string>();
  for (const { account } of response.value) {
    mints.add(account.data.parsed.info.mint);
  }
  return mints;
}
