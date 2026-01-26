"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  station_id?: string;
}

function VerlaufContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const initializeTheme = () => {
      if (typeof window === "undefined") return;
      
      // Check URL parameter first (for navigation from other pages)
      const themeParam = searchParams.get("theme");
      if (themeParam === "light" || themeParam === "dark") {
        const shouldBeDark = themeParam === "dark";
        setIsDarkMode(shouldBeDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
        localStorage.setItem("theme", themeParam);
        return;
      }
      
      // Otherwise use localStorage or system preference
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldBeDark = saved ? saved === "dark" : prefersDark;
      
      setIsDarkMode(shouldBeDark);
      document.documentElement.classList.toggle("dark", shouldBeDark);
    };

    initializeTheme();

    // Listen for storage changes (e.g., from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme") {
        const newTheme = e.newValue;
        const shouldBeDark = newTheme === "dark";
        setIsDarkMode(shouldBeDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
      }
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("theme");
      // Only update if no manual preference is saved
      if (!saved) {
        setIsDarkMode(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [searchParams]);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prüfe ob User eingeloggt ist
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Bitte melde dich an, um deinen Verlauf zu sehen");
        setLoading(false);
        return;
      }

      // Lade alle Transaktionen
      const { data, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (transactionsError) {
        console.error("Transaktionen Fehler:", transactionsError);
        setError("Fehler beim Laden der Transaktionen");
      } else if (data) {
        setTransactions(data);
      }

    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Heute, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Gestern, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `Vor ${diffDays} Tagen, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Vor ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const getTransactionInfo = (transaction: Transaction) => {
    const isPositive = transaction.amount > 0;
    const isRental = transaction.type === 'rental';
    const isReturn = transaction.type === 'return';
    
    let icon, color;
    
    if (isPositive) {
      icon = "plus";
      color = "emerald";
    } else if (isReturn) {
      icon = "check";
      color = "green";
    } else {
      icon = "battery";
      color = "blue";
    }

    return { icon, color, isPositive, isRental, isReturn };
  };

  const getIcon = (iconType: string, colorClass: string) => {
    switch (iconType) {
      case "plus":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colorClass}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      case "battery":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colorClass}>
            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
          </svg>
        );
      case "check":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colorClass}>
            <polyline points="20,6 9,17 4,12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return { bg: "bg-emerald-100", text: "text-emerald-600" };
      case "blue":
        return { bg: "bg-blue-100", text: "text-blue-600" };
      case "green":
        return { bg: "bg-green-100", text: "text-green-600" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-600" };
    }
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-0px)] flex items-center justify-center bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          <p className="text-slate-500 dark:text-gray-400">Lade Transaktionen...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-0px)] bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            const theme = isDarkMode ? "dark" : "light";
            router.push(`/app?theme=${theme}`);
          }}
          aria-label="Zurück"
          className="grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg transition-colors mt-[15px] mb-[15px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pt-20 pb-6 space-y-8">
        {/* Error message */}
        {error && (
          <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]">
            Verlauf
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]">
            Deine Transaktionshistorie
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {transactions.filter(t => t.amount > 0).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-gray-400">
                Aufladungen
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {transactions.filter(t => t.amount < 0).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-gray-400">
                Ausleihen
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Alle Transaktionen
            </h3>
          </div>
          
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-gray-400">Noch keine Transaktionen</p>
              </div>
            ) : (
              transactions.map((transaction) => {
                const info = getTransactionInfo(transaction);
                const colorClasses = getColorClasses(info.color);
                
                let iconColor, amountColor;
                if (info.isPositive) {
                  iconColor = 'text-emerald-600 dark:text-emerald-400';
                  amountColor = 'text-emerald-600 dark:text-emerald-400';
                } else if (info.isReturn) {
                  iconColor = 'text-green-600 dark:text-green-400';
                  amountColor = 'text-slate-500 dark:text-gray-400';
                } else {
                  iconColor = 'text-blue-600 dark:text-blue-400';
                  amountColor = 'text-red-600 dark:text-red-400';
                }
                
                return (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/10 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`grid place-items-center h-10 w-10 ${iconColor}`}>
                        {getIcon(info.icon, iconColor)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {transaction.description || 'Transaktion'}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-gray-400">
                          {formatDate(transaction.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold text-lg ${amountColor}`}>
                      {info.isPositive ? '+' : ''}€{Math.abs(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function VerlaufPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <VerlaufContent />
    </Suspense>
  );
}

