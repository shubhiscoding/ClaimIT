"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b-3 border-[var(--border)] bg-white">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)] border-2 border-[var(--border)] shadow-brutal-sm flex items-center justify-center">
              <span className="text-white font-black text-lg">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">
                ClaimIt
              </h1>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Solana Fund Recovery
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 ml-4">
            <Link
              href="/"
              className={`px-3 py-1.5 text-sm font-semibold border-2 transition-all ${
                pathname === "/"
                  ? "border-[var(--border)] bg-[var(--accent)] text-white shadow-brutal-sm"
                  : "border-transparent hover:border-[var(--border)] hover:bg-white"
              }`}
            >
              Recovery
            </Link>
            <Link
              href="/rent"
              className={`px-3 py-1.5 text-sm font-semibold border-2 transition-all ${
                pathname === "/rent"
                  ? "border-[var(--border)] bg-[var(--accent)] text-white shadow-brutal-sm"
                  : "border-transparent hover:border-[var(--border)] hover:bg-white"
              }`}
            >
              Rent
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
