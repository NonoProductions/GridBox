"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function applyTheme(theme: "light" | "dark") {
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("theme", theme);
  }
}

/**
 * Syncs ?theme=light|dark from URL to document + localStorage on every page.
 * useLayoutEffect = runs before paint so Wallet, Profil etc. render in correct theme.
 */
export default function ThemeSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useLayoutEffect(() => {
    // Immer zuerst echte URL lesen – useSearchParams() kann beim ersten Render leer sein
    const fromUrl =
      typeof window !== "undefined"
        ? (() => {
            const m = window.location.search.match(/[?&]theme=(light|dark)/i);
            return m ? (m[1].toLowerCase() as "light" | "dark") : null;
          })()
        : null;
    const theme = fromUrl ?? searchParams.get("theme");
    if (theme === "light" || theme === "dark") {
      applyTheme(theme);
      return;
    }
    const saved = localStorage.getItem("theme");
    const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved === "light" ? "light" : saved === "dark" ? "dark" : prefersDark ? "dark" : "light");
  }, [pathname, searchParams]);

  return null;
}
