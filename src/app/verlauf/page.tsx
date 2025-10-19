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
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

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
      <main className={`min-h-[calc(100vh-0px)] flex items-center justify-center ${
        isDarkMode ? 'text-white' : 'text-slate-900'
      }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          <p className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Lade Transaktionen...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          type="button"
          onClick={() => {
            router.push(`/app?theme=${isDarkMode ? "dark" : "light"}`);
          }}
          aria-label="Zurück"
          className={`grid place-items-center h-10 w-10 rounded-full backdrop-blur-sm ${
            isDarkMode 
              ? 'bg-white/20 text-white hover:bg-white/30' 
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 pt-4">
        {/* Error message */}
        {error && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode 
              ? 'border-red-800 bg-red-900/20 text-red-400' 
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Verlauf
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Deine Transaktionshistorie
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                {transactions.filter(t => t.amount > 0).length}
              </div>
              <div className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Aufladungen
              </div>
            </div>
          </div>
          
          <div className={`rounded-xl p-4 ${
            isDarkMode 
              ? 'bg-white/5 border border-white/10' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {transactions.filter(t => t.amount < 0).length}
              </div>
              <div className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Ausleihen
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className={`rounded-xl border ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Alle Transaktionen
            </h3>
          </div>
          
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {transactions.length === 0 ? (
              <div className={`text-center py-12 ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                <div className="mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-50">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-2">Noch keine Transaktionen</p>
                <p className="text-sm">Deine Transaktionen erscheinen hier</p>
              </div>
            ) : (
              transactions.map((transaction) => {
                const info = getTransactionInfo(transaction);
                const colorClasses = getColorClasses(info.color);
                
                return (
                  <div key={transaction.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`grid place-items-center h-10 w-10 rounded-full ${colorClasses.bg}`}>
                          {getIcon(info.icon, colorClasses.text)}
                        </div>
                        <div>
                          <div className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            {transaction.description || 'Transaktion'}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            {formatDate(transaction.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className={`font-semibold ${
                        info.isPositive
                          ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                          : info.isReturn
                            ? isDarkMode ? 'text-gray-400' : 'text-slate-500'
                            : isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {info.isPositive ? '+' : ''}€{Math.abs(transaction.amount).toFixed(2)}
                      </div>
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

