import type { Metadata } from "next";
import { SolanaProvider } from "@/components/WalletProvider";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimIt — Solana Fund Recovery",
  description:
    "Recover tokens and reclaim rent from compromised Solana wallets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col">
        <SolanaProvider>
          <Header />
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
