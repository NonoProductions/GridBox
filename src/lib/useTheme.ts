"use client";

import { useEffect, useState } from "react";

/**
 * Simplified theme hook that syncs with the ThemeScript in layout.tsx
 * The script already sets the theme immediately, this hook just reads it
 */
export function useTheme() {
  // Initialize from localStorage and DOM - read both to ensure accuracy
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    
    // First check localStorage (most reliable)
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    
    // Fallback to DOM (set by ThemeScript - should be set by now)
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    // Read current theme from DOM and localStorage to ensure sync
    const updateTheme = () => {
      const saved = localStorage.getItem("theme");
      let shouldBeDark = false;
      
      if (saved === "dark") {
        shouldBeDark = true;
      } else if (saved === "light") {
        shouldBeDark = false;
      } else {
        // Check DOM (set by ThemeScript)
        shouldBeDark = document.documentElement.classList.contains("dark");
      }
      
      // Update state
      setIsDark(shouldBeDark);
      
      // Ensure DOM matches
      if (shouldBeDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    // Initial sync immediately
    updateTheme();

    // Listen for theme changes
    const handleThemeChange = () => updateTheme();
    window.addEventListener("themechange", handleThemeChange);

    // Listen for storage changes (other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme") {
        updateTheme();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    // Read current state from DOM to ensure accuracy
    const currentlyDark = document.documentElement.classList.contains("dark");
    const newIsDark = !currentlyDark;
    
    // Update DOM immediately - CSS transitions will handle the animation
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Update state
    setIsDark(newIsDark);
    
    // Update localStorage
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
    
    // Dispatch event for other components
    window.dispatchEvent(new Event("themechange"));
  };

  return { isDark, toggleTheme };
}
