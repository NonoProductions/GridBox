"use client";

import { useLayoutEffect, useEffect, useState } from "react";

interface SearchParamsLike {
  get(name: string): string | null;
}

function getInitialIsDark(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("theme");
  if (saved === "light") return false;
  if (saved === "dark") return true;
  return document.documentElement.classList.contains("dark");
}

export function applyThemeToDocument(theme: "light" | "dark", persist = true) {
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
  if (persist && typeof localStorage !== "undefined") localStorage.setItem("theme", theme);
}

export interface UsePageThemeOptions {
  /** Wenn true: Ohne URL-Theme und ohne gespeichertes Theme → Dark (nur Anzeige, wird nicht in localStorage geschrieben). */
  defaultDark?: boolean;
}

function getInitialIsDarkFromParams(
  searchParams: SearchParamsLike | null,
  defaultDark = false
): boolean {
  if (typeof window === "undefined") {
    const themeParam = searchParams?.get("theme");
    if (themeParam === "light") return false;
    if (themeParam === "dark") return true;
    return defaultDark;
  }
  // Client: zuerst echte URL – useSearchParams() kann beim ersten Render noch leer sein
  const m = window.location.search.match(/[?&]theme=(light|dark)/i);
  if (m) return m[1].toLowerCase() === "dark";
  const themeParam = searchParams?.get("theme");
  if (themeParam === "light") return false;
  if (themeParam === "dark") return true;
  const saved = localStorage.getItem("theme");
  if (saved === "light") return false;
  if (saved === "dark") return true;
  if (defaultDark) return true;
  return getInitialIsDark();
}

/**
 * Theme für Seiten mit URL-Parameter ?theme=light|dark.
 * useLayoutEffect = Theme wird VOR dem ersten Paint gesetzt, damit Wallet/Profil etc. sofort hell sind.
 * @param options.defaultDark Wenn true und weder URL noch localStorage haben ein Theme → Dark (nur Anzeige, nicht speichern).
 */
export function usePageTheme(
  searchParams: SearchParamsLike | null,
  options?: UsePageThemeOptions
) {
  const defaultDark = options?.defaultDark ?? false;
  const [isDarkMode, setIsDarkMode] = useState(() =>
    getInitialIsDarkFromParams(searchParams, defaultDark)
  );

  // WICHTIG: useLayoutEffect läuft vor dem Paint. Theme aus echter URL lesen –
  // useSearchParams() kann beim ersten Render/Hydration noch leer sein.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const fromUrl = (() => {
      const m = window.location.search.match(/[?&]theme=(light|dark)/i);
      return m ? (m[1].toLowerCase() as "light" | "dark") : null;
    })();
    const themeParam = fromUrl ?? searchParams?.get("theme") ?? null;
    if (themeParam === "light" || themeParam === "dark") {
      applyThemeToDocument(themeParam);
      queueMicrotask(() => setIsDarkMode(themeParam === "dark"));
    } else {
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldBeDark = saved ? saved === "dark" : defaultDark ? true : prefersDark;
      queueMicrotask(() => setIsDarkMode(shouldBeDark));
      // Bei defaultDark und keinem gespeicherten Theme: nur Anzeige auf Dark, nicht in localStorage schreiben
      const persist = !defaultDark || !!saved;
      applyThemeToDocument(shouldBeDark ? "dark" : "light", persist);
    }
  }, [searchParams, defaultDark]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return;
      const v = e.newValue;
      const dark = v === "dark";
      setIsDarkMode(dark);
      applyThemeToDocument(dark ? "dark" : "light");
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => {
      const saved2 = localStorage.getItem("theme");
      if (saved2) return;
      const dark = media.matches;
      setIsDarkMode(dark);
      applyThemeToDocument(dark ? "dark" : "light");
    };

    window.addEventListener("storage", handleStorage);
    media.addEventListener("change", handleMedia);
    return () => {
      window.removeEventListener("storage", handleStorage);
      media.removeEventListener("change", handleMedia);
    };
  }, []);

  return isDarkMode;
}
