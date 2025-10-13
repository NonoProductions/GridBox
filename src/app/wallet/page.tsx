"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function WalletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState(100.00); // Fiktives Guthaben von 100€
  const [addAmount, setAddAmount] = useState("");
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Get theme from URL parameter, default to dark mode
  const isDarkMode = searchParams.get("theme") === "light" ? false : true;

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setBalance(prev => prev + amount);
      setAddAmount("");
      setShowAddMoney(false);
      setSuccess(`€${amount.toFixed(2)} erfolgreich hinzugefügt!`);
      setLoading(false);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    }, 1500);
  };

  const quickAddAmounts = [5, 10, 20, 50];

  return (
    <main className={`min-h-[calc(100vh-0px)] ${
      isDarkMode ? 'text-white' : 'text-slate-900'
    }`} style={isDarkMode ? { backgroundColor: "#282828" } : { backgroundColor: "#ffffff" }}>
      {/* Back button */}
      <div className="absolute top-20 left-4 z-10" style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
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
      <div className="p-6 space-y-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}>
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
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Letzte Transaktionen
          </h3>
          
          <div className="space-y-3">
            {/* Sample transactions */}
            <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${
              isDarkMode ? 'bg-white/5' : 'bg-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Guthaben aufgeladen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Heute, 14:30
                  </div>
                </div>
              </div>
              <div className="text-emerald-600 font-semibold">
                +€50.00
              </div>
            </div>

            <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${
              isDarkMode ? 'bg-white/5' : 'bg-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-full bg-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
                    <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Powerbank ausgeliehen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Gestern, 16:45
                  </div>
                </div>
              </div>
              <div className="text-red-600 font-semibold">
                -€2.50
              </div>
            </div>

            <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${
              isDarkMode ? 'bg-white/5' : 'bg-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div>
                  <div className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    Guthaben aufgeladen
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    Vor 3 Tagen, 10:15
                  </div>
                </div>
              </div>
              <div className="text-emerald-600 font-semibold">
                +€25.00
              </div>
            </div>
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
