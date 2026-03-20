import type { Metadata } from "next";
import { SolanaProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimIt — Reclaim Solana Rent",
  description: "Close empty token accounts and reclaim your SOL rent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
