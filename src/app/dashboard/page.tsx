"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OwnerDashboard from "@/components/OwnerDashboard";
import { usePageTheme } from "@/lib/usePageTheme";

function DashboardContent() {
  const searchParams = useSearchParams();
  const isDarkMode = usePageTheme(searchParams);

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
