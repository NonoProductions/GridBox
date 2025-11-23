"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OwnerDashboard from "@/components/OwnerDashboard";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const applyTheme = (mode: "light" | "dark") => setIsDarkMode(mode === "dark");

    if (themeParam === "light" || themeParam === "dark") {
      applyTheme(themeParam);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (event: MediaQueryListEvent) => applyTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeParam]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <OwnerDashboard
      isDarkMode={isDarkMode}
      variant="page"
    />
  );
}
