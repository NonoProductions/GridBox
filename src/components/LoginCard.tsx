"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginCard() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState<null | { kind: "ok" | "error"; msg: string }>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!isValidEmail(email)) {
      setStatus({ kind: "error", msg: "Bitte eine gültige E-Mail-Adresse eingeben." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email, 
        options: { 
          shouldCreateUser: true 
        } 
      });
      if (error) throw error;
      setOtpSent(true);
      setStatus({ kind: "ok", msg: "6-stelliger Code wurde gesendet. Bitte Posteingang prüfen." });
    } catch (err: unknown) {
      setStatus({ kind: "error", msg: (err as Error)?.message ?? "Unbekannter Fehler." });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (otpCode.length !== 6) {
      setStatus({ kind: "error", msg: "Bitte gib den 6-stelligen Code ein." });
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ 
        email, 
        token: otpCode, 
        type: 'email' 
      });
      if (error) throw error;
      setStatus({ kind: "ok", msg: "Erfolgreich angemeldet!" });
      // Die Weiterleitung erfolgt automatisch über den AuthGate
    } catch (err: unknown) {
      setStatus({ kind: "error", msg: (err as Error)?.message ?? "Ungültiger Code. Bitte erneut versuchen." });
    } finally {
      setVerifying(false);
    }
  }

  function handleBackToEmail() {
    setOtpSent(false);
    setOtpCode("");
    setStatus(null);
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Logo/Icon Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl mb-6">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="40" 
            height="40" 
            fill="none" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M12 22s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/>
            <path d="M13 11h3l-4 6v-4H9l4-6v4z" fill="white" stroke="white"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">GridBox</h1>
        <p className="text-slate-600 dark:text-slate-400">Powerbank ausleihen, jederzeit & überall</p>
      </div>

      {/* Login Card */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-slate-200/50 dark:border-gray-700/50">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {otpSent ? "Code eingeben" : "Willkommen zurück"}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {otpSent 
              ? "Gib den 6-stelligen Code aus deiner E-Mail ein" 
              : "Login per Code – kein Passwort nötig"
            }
          </p>
        </div>

        {status && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${
              status.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2">
              {status.kind === "ok" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              <span>{status.msg}</span>
            </div>
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                E-Mail-Adresse
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-12 pr-4 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-4 focus:ring-emerald-500/30 dark:focus:ring-emerald-500/40 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 font-semibold text-base shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Wird gesendet...</span>
                </div>
              ) : (
                "Code senden"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
            <div>
              <label htmlFor="otp" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                6-stelliger Code
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-12 pr-4 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-4 focus:ring-emerald-500/30 dark:focus:ring-emerald-500/40 transition-all text-center text-2xl font-mono tracking-widest"
                  required
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Code an <strong>{email}</strong> gesendet
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="flex-1 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 py-4 font-semibold text-base hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-all duration-200"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={verifying || otpCode.length !== 6}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 font-semibold text-base shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {verifying ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Prüfe...</span>
                  </div>
                ) : (
                  "Anmelden"
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-gray-700">
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Mit dem Login stimmst du unseren{" "}
            <span className="text-emerald-600 dark:text-emerald-500 font-medium">
              Nutzungsbedingungen
            </span>{" "}
            zu
          </p>
        </div>
      </div>

      {/* Bottom info */}
      <div className="mt-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Neu bei GridBox?{" "}
          <span className="text-emerald-600 dark:text-emerald-500 font-semibold">
            Einfach anmelden und loslegen!
          </span>
        </p>
      </div>
    </div>
  );
}
