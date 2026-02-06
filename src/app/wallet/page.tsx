"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePageTheme } from "@/lib/usePageTheme";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  station_id?: string;
}

interface ActiveRental {
  id: string;
  station_id: string;
  started_at: string;
  start_price: number;
  price_per_minute: number;
}

function WalletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState(0);
  const [addAmount, setAddAmount] = useState("");
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const isDarkMode = usePageTheme(searchParams);
  const [activeRental, setActiveRental] = useState<ActiveRental | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Lade Wallet-Daten beim Start
  useEffect(() => {
    loadWalletData();
  }, []);

  // Timer für Live-Counter bei aktiver Ausleihe
  useEffect(() => {
    if (!activeRental) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRental]);

  const loadWalletData = async () => {
    try {
      setInitialLoading(true);
      setError(null);

      // Prüfe ob User eingeloggt ist
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Bitte melde dich an, um dein Wallet zu sehen");
        setInitialLoading(false);
        return;
      }

      // Lade Wallet-Balance
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError) {
        console.error("Wallet Fehler:", walletError);
        setError("Fehler beim Laden des Wallets");
      } else if (walletData) {
        setBalance(parseFloat(walletData.balance));
      }

      // Prüfe auf aktive Ausleihe für Live-Counter
      const { data: rentalData, error: rentalError } = await supabase
        .from('rentals')
        .select('id, station_id, started_at, start_price, price_per_minute')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (rentalError) {
        console.error("Rental Fehler:", rentalError);
      } else if (rentalData) {
        setActiveRental({
          id: rentalData.id,
          station_id: rentalData.station_id,
          started_at: rentalData.started_at,
          start_price: parseFloat(rentalData.start_price),
          price_per_minute: parseFloat(rentalData.price_per_minute),
        });
      } else {
        setActiveRental(null);
      }

      // Lade letzte 3 Transaktionen
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (transactionsError) {
        console.error("Transaktionen Fehler:", transactionsError);
      } else if (transactionsData) {
        setRecentTransactions(transactionsData);
      }

    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Hole User
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Bitte melde dich an");
        setLoading(false);
        return;
      }

      // Rufe die add_money_to_wallet Funktion auf
      const { data, error } = await supabase.rpc('add_money_to_wallet', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: 'Guthaben aufgeladen'
      });

      if (error) {
        console.error("Fehler beim Hinzufügen:", error);
        setError("Fehler beim Hinzufügen von Guthaben");
      } else if (data && data.success) {
        setBalance(parseFloat(data.new_balance));
        setAddAmount("");
        setShowAddMoney(false);
        setSuccess(`€${amount.toFixed(2)} erfolgreich hinzugefügt!`);
        
        // Lade Transaktionen neu
        loadWalletData();
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Fehler:", err);
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
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const quickAddAmounts = [5, 10, 20, 50];

  const renderActiveRentalBanner = () => {
    if (!activeRental) return null;

    const start = new Date(activeRental.started_at).getTime();
    const diffMs = now - start;
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const minutesAsDecimal = diffMs / 60000; // für Preisberechnung
    const currentPrice =
      activeRental.start_price +
      Math.max(0, minutesAsDecimal) * activeRental.price_per_minute;

    return (
      <div className="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/60 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Aktive Ausleihe
          </div>
          <div className="text-sm text-slate-800 dark:text-white mt-1">
            Dauer:{" "}
            <span className="font-semibold">
              {minutes.toString().padStart(2, "0")}:
              {seconds.toString().padStart(2, "0")} Min
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">
            Aktueller Preis:{" "}
            <span className="font-semibold">
              €{currentPrice.toFixed(2)}
            </span>{" "}
            (inkl. Startpreis)
          </div>
        </div>
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-600 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return (
      <main className="min-h-[calc(100vh-0px)] flex items-center justify-center bg-white dark:bg-[#282828] text-slate-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          <p className="text-slate-500 dark:text-gray-400">Lade Wallet...</p>
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
        {/* Success message */}
        {success && (
          <div className="px-4 py-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl">
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
            {error}
          </div>
        )}

        {/* Wallet Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white flex flex-col justify-start items-center gap-0 -mt-[65px]">
            Wallet
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 -mt-[5px] -mb-[5px]">
            Verwalte dein Guthaben
          </p>
        </div>

        {/* Balance Display - Minimalistisch */}
        <div className="text-center">
          <div className="text-[40px] font-bold text-emerald-600 dark:text-emerald-400 mb-4">
            €{balance.toFixed(2)}
          </div>
          <button
            onClick={() => setShowAddMoney(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors active:scale-95"
          >
            Geld hinzufügen
          </button>
        </div>

        {/* Aktive Ausleihe – Live Counter */}
        {renderActiveRentalBanner()}

        {/* Quick Add Money - Minimalistisch */}
        {showAddMoney && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Geld hinzufügen
              </h3>
              <button
                onClick={() => {
                  setShowAddMoney(false);
                  setAddAmount("");
                }}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
                aria-label="Schließen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            {/* Quick amounts */}
            <div className="grid grid-cols-2 gap-3">
              {quickAddAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setAddAmount(amount.toString())}
                  className={`py-4 rounded-xl font-semibold transition-all duration-200 ${
                    addAmount === amount.toString()
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20'
                  }`}
                >
                  €{amount}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <form onSubmit={handleAddMoney} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-white/90">
                  Betrag eingeben
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-lg font-semibold text-slate-500 dark:text-white/60">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 px-4 py-3.5 pl-10 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMoney(false);
                    setAddAmount("");
                  }}
                  className="flex-1 py-3.5 rounded-xl font-semibold transition-colors bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading || !addAmount || parseFloat(addAmount) <= 0}
                  className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Hinzufügen...</span>
                    </div>
                  ) : (
                    'Hinzufügen'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Transaction History - Minimalistisch */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Letzte Transaktionen
            </h3>
            <button
              onClick={() => {
                const theme = isDarkMode ? "dark" : "light";
                router.push(`/verlauf?theme=${theme}`);
              }}
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Alle anzeigen →
            </button>
          </div>
          
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-gray-400">Noch keine Transaktionen</p>
              </div>
            ) : (
              recentTransactions.map((transaction) => {
                const isPositive = transaction.amount > 0;
                const isRental = transaction.type === 'rental';
                const isReturn = transaction.type === 'return';
                
                // Icon and color based on transaction type
                let iconColor, amountColor;
                if (isPositive) {
                  iconColor = 'text-emerald-600 dark:text-emerald-400';
                  amountColor = 'text-emerald-600 dark:text-emerald-400';
                } else if (isReturn) {
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
                        {isPositive ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        ) : isReturn ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                          </svg>
                        )}
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
                      {isPositive ? '+' : ''}€{Math.abs(transaction.amount).toFixed(2)}
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

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lädt...</div>}>
      <WalletContent />
    </Suspense>
  );
}
