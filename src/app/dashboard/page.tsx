"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OwnerDashboard from "@/components/OwnerDashboard";

function DashboardContent() {
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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
