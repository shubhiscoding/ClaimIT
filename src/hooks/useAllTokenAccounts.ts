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

      const tokens: TokenAccountInfo[] = [];
      const empty: TokenAccountInfo[] = [];

      for (const { pubkey, account } of response.value) {
        const parsed = account.data.parsed;
        const info = parsed.info;
        const mint: string = info.mint;
        const amount = BigInt(info.tokenAmount.amount);
        const decimals: number = info.tokenAmount.decimals;
        const uiAmount: number = info.tokenAmount.uiAmount ?? 0;

        const entry: TokenAccountInfo = {
          pubkey,
          mint,
          amount,
          decimals,
          uiAmount,
        };

        if (amount > 0n) {
          tokens.push(entry);
        } else {
          empty.push(entry);
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
