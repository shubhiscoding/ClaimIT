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
          <main className="flex-1 pb-10">{children}</main>
          <footer className="fixed bottom-0 left-0 right-0 z-50 border-t-3 border-[var(--border)] bg-white px-6 py-2.5 flex items-center justify-between text-xs text-[var(--muted)]">
            <div>
              {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
                <a
                  href={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-[var(--accent)] transition-colors"
                >
                  Demo Video
                </a>
              )}
            </div>
            <div>
              For help / bug report / feature request contact:{" "}
              {process.env.NEXT_PUBLIC_CONTACT_URL ? (
                <a
                  href={process.env.NEXT_PUBLIC_CONTACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold hover:text-[var(--accent)] transition-colors"
                >
                  Shubh
                </a>
              ) : (
                <span className="font-bold">Shubh</span>
              )}
            </div>
          </footer>
        </SolanaProvider>
      </body>
    </html>
  );
}
