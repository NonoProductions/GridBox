"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationOverlay() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  // Wenn neue Seite gerendert wurde → Overlay ausblenden
  useEffect(() => {
    setVisible(false);
  }, [pathname]);

  // Auf "navigation-start" Event hören
  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener("navigation-start", show);
    return () => window.removeEventListener("navigation-start", show);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-white dark:bg-[#282828]"
      aria-hidden="true"
    />
  );
}
