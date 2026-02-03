"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isOwner } from "@/lib/userRoles";

const MENU_ANIMATION_MS = 300;

export default function SideMenu({ 
  open, 
  onClose, 
  isDarkMode, 
  onToggleTheme
}: { 
  open: boolean; 
  onClose: () => void; 
  isDarkMode: boolean; 
  onToggleTheme: () => void;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [userIsOwner, setUserIsOwner] = useState<boolean>(false);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [backdropVisible, setBackdropVisible] = useState(false);
  const [panelSlideIn, setPanelSlideIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      const u = data.user;
      
      // Prüfe ob Nutzer angemeldet ist
      setIsAuthenticated(!!u);
      
      if (u) {
        const name = (u?.user_metadata as Record<string, unknown>)?.full_name as string || u?.email || "";
        setDisplayName(name);
        
        // Prüfe Owner-Status
        const ownerStatus = await isOwner();
        setUserIsOwner(ownerStatus);
      } else {
        setDisplayName("");
        setUserIsOwner(false);
      }
    }
    
    async function loadStats() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted || !data.user) return;
      
      // Lade Statistiken aus der Datenbank
      // TODO: Anpassen an tatsächliche Tabellenstruktur
      const { data: sessions } = await supabase
        .from('charging_sessions')
        .select('duration_hours')
        .eq('user_id', data.user.id);
      
      if (sessions) {
        setTotalSessions(sessions.length);
        const hours = sessions.reduce((sum, session) => sum + (session.duration_hours || 0), 0);
        setTotalHours(Math.round(hours * 10) / 10); // Auf 1 Dezimalstelle runden
      }
    }
    
    loadUser();
    loadStats();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadUser();
      loadStats();
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Öffnen: Panel von links reinsliden, Backdrop einblenden
  useEffect(() => {
    if (open) {
      setIsClosing(false);
      setBackdropVisible(false);
      setPanelSlideIn(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setBackdropVisible(true);
          setPanelSlideIn(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setBackdropVisible(false);
      setPanelSlideIn(false);
    }
  }, [open]);

  // Schließen: erst animieren, dann onClose
  const handleClose = () => {
    if (closeTimeoutRef.current) return;
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsClosing(false);
      onClose();
    }, MENU_ANIMATION_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const menuVisible = open && !isClosing;
  const panelShown = menuVisible && panelSlideIn;

  return (
    <>
      {/* Backdrop mit Ein-/Ausblend-Animation */}
      {(open || isClosing) && (
        <div
          className={`fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${
            backdropVisible && menuVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Panel: slide von links rein */}
      <aside
        className={`fixed top-0 left-0 z-[1110] h-full w-80 max-w-[85vw] ${
          isDarkMode 
            ? 'text-white border-r border-gray-600' 
            : 'bg-white text-slate-900 border-r border-slate-200'
        } shadow-2xl transition-transform duration-300 ease-out ${
          panelShown ? "translate-x-0" : "-translate-x-full"
        }`}
        style={isDarkMode ? { backgroundColor: '#282828' } : {}}
      >
        {!isAuthenticated ? (
          // Nicht angemeldete Nutzer
          <>
            <div className="px-6 pt-4 pb-4">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Hallo!</h2>
              </div>
              
              {/* Anmeldeaufforderung */}
              <div className={`rounded-xl p-4 border ${
                isDarkMode 
                  ? 'bg-emerald-900/20 border-emerald-800' 
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-emerald-400 mt-0.5' : 'text-emerald-600 mt-0.5'}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <div>
                    <div className={`font-medium mb-1 ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}>
                      Anmeldung erforderlich
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-emerald-300' : 'text-emerald-600'
                    }`}>
                      Bitte melde dich an, um alle Funktionen zu nutzen.
                    </div>
                  </div>
                </div>
              </div>

              {/* Anmeldebutton */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/login?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full mt-4 py-3 rounded-xl font-medium ${
                  isDarkMode 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                Jetzt anmelden
              </button>
            </div>

            <div className="py-2">
              {/* Hilfe - immer verfügbar */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/hilfe?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'hover:bg-gray-700/50 active:bg-gray-700' : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="flex-1 text-left text-base">Hilfe</span>
              </button>
            </div>
          </>
        ) : (
          // Angemeldete Nutzer
          <>
            <div className="px-6 pt-4 pb-4">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Hallo{displayName ? `, ${displayName}` : ""}</h2>
              </div>
              
              {/* Statistiken */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-4 ${
                  isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                }`}>
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`}>
                    {totalHours}h
                  </div>
                  <div className={`text-sm mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Geladen
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 ${
                  isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                }`}>
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`}>
                    {totalSessions}
                  </div>
                  <div className={`text-sm mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Ladungen
                  </div>
                </div>
              </div>
            </div>

            <div className="py-2">
              {/* Wallet */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/wallet?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <span className="flex-1 text-left text-base">Wallet</span>
              </button>

              {/* Verlauf */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/verlauf?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l4 2" />
                </svg>
                <span className="flex-1 text-left text-base">Verlauf</span>
              </button>

              {/* Reservierung */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/reservierung?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="flex-1 text-left text-base">Reservierung</span>
              </button>

              {/* Hilfe */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/hilfe?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="flex-1 text-left text-base">Hilfe</span>
              </button>

              {/* Owner Dashboard - nur für Owner sichtbar */}
              {userIsOwner && (
                <button 
                  onClick={() => {
                    onClose();
                    router.push(`/dashboard?theme=${isDarkMode ? "dark" : "light"}`);
                  }}
                  className={`w-full flex items-center gap-4 px-6 py-4 ${
                    isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="flex-1 text-left text-base">Owner Dashboard</span>
                </button>
              )}

              {/* Einstellungen */}
              <button 
                onClick={() => {
                  onClose();
                  router.push(`/profile?theme=${isDarkMode ? "dark" : "light"}`);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 ${
                  isDarkMode ? 'active:bg-gray-700' : 'active:bg-gray-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="flex-1 text-left text-base">Einstellungen</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
