"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  station_id?: string;
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
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

  // Lade Wallet-Daten beim Start
  useEffect(() => {
    loadWalletData();
  }, []);

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

  if (initialLoading) {
    return (
      <main className={`min-h-[calc(100vh-0px)] flex items-center justify-center ${
        isDarkMode ? 'text-white' : 'text-slate-900'
      }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          <p className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Lade Wallet...</p>
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
        {/* Success message */}
        {success && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            isDarkMode 
              ? 'border-green-800 bg-green-900/20 text-green-400' 
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {success}
          </div>
        )}

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

        {/* Wallet Header */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Wallet
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Verwalte dein Guthaben
          </p>
        </div>

        {/* Balance Card */}
        <div className={`rounded-2xl p-6 shadow-lg ${
          isDarkMode 
            ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' 
            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div>
                <div className="text-white/80 text-sm">Aktuelles Guthaben</div>
                <div className="text-white text-3xl font-bold">
                  €{balance.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddMoney(true)}
            className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Geld hinzufügen
          </button>
        </div>

        {/* Quick Add Money */}
        {showAddMoney && (
          <div className={`rounded-xl border p-4 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Geld hinzufügen
            </h3>
            
            {/* Quick amounts */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {quickAddAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setAddAmount(amount.toString())}
                  className={`py-3 rounded-xl font-medium transition-colors ${
                    addAmount === amount.toString()
                      ? 'bg-emerald-600 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                  }`}
                >
                  €{amount}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <form onSubmit={handleAddMoney} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-white/90' : 'text-slate-700'
                }`}>
                  Betrag eingeben
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-lg ${
                    isDarkMode ? 'text-white/60' : 'text-slate-500'
                  }`}>
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full rounded-xl border px-4 py-3 pl-8 outline-none focus:ring-4 ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-emerald-900/40' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus:ring-emerald-500/40'
                    }`}
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
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                  }`}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading || !addAmount || parseFloat(addAmount) <= 0}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium shadow hover:opacity-95 disabled:opacity-60 transition-opacity"
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

        {/* Transaction History */}
        <div className={`rounded-xl border p-4 ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Letzte Transaktionen
            </h3>
            <button
              onClick={() => router.push(`/verlauf?theme=${isDarkMode ? "dark" : "light"}`)}
              className={`text-sm font-medium ${
                isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
              }`}
            >
              Alle anzeigen →
            </button>
          </div>
          
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <div className={`text-center py-8 ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                Noch keine Transaktionen
              </div>
            ) : (
              recentTransactions.map((transaction) => {
                const isPositive = transaction.amount > 0;
                const isRental = transaction.type === 'rental';
                const isReturn = transaction.type === 'return';
                
                return (
                  <div key={transaction.id} className={`flex items-center justify-between py-3 px-4 rounded-xl ${
                    isDarkMode ? 'bg-white/5' : 'bg-white'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`grid place-items-center h-10 w-10 rounded-full ${
                        isPositive ? 'bg-emerald-100' : isReturn ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {isPositive ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        ) : isReturn ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                          </svg>
                        )}
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
                      isPositive 
                        ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                        : isReturn
                          ? isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          : isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`}>
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
