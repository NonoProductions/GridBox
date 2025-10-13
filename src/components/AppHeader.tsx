"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const HIDE_ON = new Set(["/", "/auth/callback", "/onboarding", "/profile", "/wallet", "/verlauf", "/hilfe", "/reservierung","/dashboard"]);

export default function AppHeader() {
  const pathname = usePathname();
  if (!pathname || HIDE_ON.has(pathname)) return null;

  return (
    <header className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
      <Link href="/" className="font-semibold">GridBox</Link>
      <Link href="/app" className="hover:underline">App</Link>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}


