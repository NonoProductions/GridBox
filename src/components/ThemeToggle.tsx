"use client";

import { useTheme } from "@/lib/useTheme";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className="text-sm px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
      onClick={toggleTheme}
      aria-label={isDark ? "Zu Light Mode wechseln" : "Zu Dark Mode wechseln"}
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
