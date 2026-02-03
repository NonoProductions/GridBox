"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Email validation with length limits and stricter pattern
const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(email);
};

// Sanitize OTP code - only allow digits
const sanitizeOtpCode = (code: string): string => {
  return code.replace(/\D/g, '').slice(0, 6);
};

interface LoginCardProps {
  isDarkMode?: boolean;
  isFromRental?: boolean;
}

export default function LoginCard({ isDarkMode = true, isFromRental = false }: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState<null | { kind: "ok" | "error"; msg: string }>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setStatus({ kind: "error", msg: "Bitte eine gültige E-Mail-Adresse eingeben." });
      return;
    }
    
    setLoading(true);
    try {
      const lastOtpTime = localStorage.getItem(`otp_${trimmedEmail}`);
      const now = Date.now();
      if (lastOtpTime && now - parseInt(lastOtpTime, 10) < 60000) {
        setStatus({ kind: "error", msg: "Bitte warten Sie einen Moment, bevor Sie erneut einen Code anfordern." });
        setLoading(false);
        return;
      }
      
      const { error } = await supabase.auth.signInWithOtp({ 
        email: trimmedEmail, 
        options: { 
          shouldCreateUser: true,
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : undefined,
        } 
      });
      
      if (error) {
        const errorMessage = error.message.includes('rate limit') 
          ? "Zu viele Anfragen. Bitte warten Sie einen Moment."
          : "Fehler beim Senden des Codes. Bitte versuchen Sie es erneut.";
        throw new Error(errorMessage);
      }
      
      localStorage.setItem(`otp_${trimmedEmail}`, now.toString());
      setOtpSent(true);
      setStatus({ kind: "ok", msg: "Code wurde an deine E-Mail gesendet." });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler.";
      setStatus({ kind: "error", msg: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    
    const sanitizedCode = sanitizeOtpCode(otpCode);
    if (sanitizedCode.length !== 6) {
      setStatus({ kind: "error", msg: "Bitte gib den 6-stelligen Code ein." });
      return;
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setStatus({ kind: "error", msg: "Ungültige E-Mail-Adresse." });
      return;
    }
    
    setVerifying(true);
    try {
      const verifyKey = `verify_${trimmedEmail}`;
      const lastVerifyTime = localStorage.getItem(verifyKey);
      const now = Date.now();
      if (lastVerifyTime && now - parseInt(lastVerifyTime, 10) < 5000) {
        setStatus({ kind: "error", msg: "Bitte warten Sie einen Moment vor dem nächsten Versuch." });
        setVerifying(false);
        return;
      }
      
      const { error } = await supabase.auth.verifyOtp({ 
        email: trimmedEmail, 
        token: sanitizedCode, 
        type: 'email' 
      });
      
      if (error) {
        const errorMessage = error.message.includes('expired')
          ? "Code abgelaufen. Bitte fordern Sie einen neuen Code an."
          : error.message.includes('invalid')
          ? "Ungültiger Code. Bitte erneut versuchen."
          : "Fehler bei der Verifizierung. Bitte versuchen Sie es erneut.";
        throw new Error(errorMessage);
      }
      
      localStorage.setItem(verifyKey, now.toString());
      setStatus({ kind: "ok", msg: "Erfolgreich angemeldet!" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ungültiger Code. Bitte erneut versuchen.";
      setStatus({ kind: "error", msg: errorMessage });
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
    <div className="w-full max-w-md">
      {/* Hauptkarte */}
      <div className={`rounded-2xl overflow-hidden ${
        isDarkMode ? 'bg-gray-800/50' : 'bg-white shadow-lg'
      }`}>
        {/* Header */}
        <div className={`p-6 text-center ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
          <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {otpSent ? "Code eingeben" : (isFromRental ? "Anmelden & ausleihen" : "Willkommen")}
          </h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
            {otpSent 
              ? "Gib den 6-stelligen Code aus deiner E-Mail ein" 
              : "Login per Code – kein Passwort nötig"
            }
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status-Meldung */}
          {status && (
            <div className={`mb-4 rounded-lg p-3 text-sm ${
              status.kind === "ok"
                ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')
            }`}>
              {status.msg}
            </div>
          )}

          {/* E-Mail-Formular */}
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  className={`w-full rounded-xl px-4 py-3 outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700/50 text-white placeholder:text-gray-500 border border-gray-600 focus:border-emerald-500' 
                      : 'bg-white text-slate-900 placeholder:text-slate-400 border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 text-white px-6 h-12 font-medium shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Wird gesendet...</span>
                  </div>
                ) : (
                  "Code senden"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="otp" className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  6-stelliger Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(sanitizeOtpCode(e.target.value))}
                  placeholder="123456"
                  className={`w-full rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700/50 text-white placeholder:text-gray-500 border border-gray-600 focus:border-emerald-500' 
                      : 'bg-white text-slate-900 placeholder:text-slate-400 border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                  required
                  autoFocus
                />
                <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  Code an <strong>{email}</strong> gesendet
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className={`flex-1 rounded-xl px-6 h-12 font-medium transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700 border border-gray-600 text-white hover:bg-gray-600' 
                      : 'bg-gray-100 border border-gray-300 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Zurück
                </button>
                <button
                  type="submit"
                  disabled={verifying || otpCode.length !== 6}
                  className="flex-1 rounded-xl bg-emerald-600 text-white px-6 h-12 font-medium shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {verifying ? (
                    <div className="flex items-center justify-center gap-2">
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
        </div>
      </div>

      {/* Footer-Info */}
      {!isFromRental && (
        <div className="mt-6 text-center">
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
            Neu bei GridBox?{" "}
            <span className={`font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Einfach anmelden und loslegen!
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
