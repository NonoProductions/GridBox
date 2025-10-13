"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialisiere den Theme-Status basierend auf dem aktuellen DOM-Zustand
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    setIsDark(isCurrentlyDark);

    // Höre auf localStorage Änderungen (falls das Theme von einer anderen Stelle geändert wird)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const newTheme = e.newValue;
        const shouldBeDark = newTheme === 'dark';
        setIsDark(shouldBeDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    // Aktualisiere DOM
    document.documentElement.classList.toggle("dark", newIsDark);
    
    // Aktualisiere localStorage
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
  };

  return (
    <button
      className="text-sm px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700"
      onClick={toggleTheme}
    >
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
