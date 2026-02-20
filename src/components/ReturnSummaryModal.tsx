"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ReturnSummaryData {
  rentalId: string;
  stationName: string;
  stationAddress?: string;
  powerbankId?: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalPrice: number;
}

interface ReturnSummaryModalProps {
  data: ReturnSummaryData;
  isDarkMode: boolean;
  onClose: () => void;
}

export default function ReturnSummaryModal({
  data,
  isDarkMode,
  onClose,
}: ReturnSummaryModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hours = Math.floor(data.durationMinutes / 60);
  const mins = Math.round(data.durationMinutes % 60);

  const startDate = new Date(data.startedAt);
  const endDate = new Date(data.endedAt);
  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const startTime = startDate.toLocaleTimeString("de-DE", timeFormat);
  const endTime = endDate.toLocaleTimeString("de-DE", timeFormat);

  const saveRating = async (stars: number) => {
    try {
      await supabase
        .from("rentals")
        .update({ rating: stars })
        .eq("id", data.rentalId);
    } catch { /* silent */ }
  };

  const submitIssue = async () => {
    if (!issueText.trim()) return;
    setSubmitting(true);
    try {
      await supabase
        .from("rentals")
        .update({ issue_report: issueText.trim() })
        .eq("id", data.rentalId);
      setSubmitted(true);
      setShowIssueForm(false);
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const bg = isDarkMode ? "bg-[#0f1419]" : "bg-white";
  const card = isDarkMode ? "bg-gray-800/60 border-gray-700/50" : "bg-gray-50 border-gray-200/80";
  const text = isDarkMode ? "text-white" : "text-slate-900";
  const textMuted = isDarkMode ? "text-gray-400" : "text-slate-500";
  const textSub = isDarkMode ? "text-gray-300" : "text-slate-600";

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-md rounded-t-3xl ${bg} ${text} shadow-2xl animate-slide-up overflow-hidden`}
        style={{ maxHeight: "92vh" }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: "92vh" }}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">Powerbank zurückgegeben</h2>
            <p className={`text-sm mt-1 ${textMuted}`}>
              Hier ist deine Zusammenfassung
            </p>
          </div>

          {/* Summary Card */}
          <div className={`mx-5 rounded-2xl border p-4 ${card}`}>
            {/* Station */}
            <div className="flex items-start gap-3 mb-3">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-emerald-500/15 flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-medium ${textMuted}`}>Station</div>
                <div className="text-sm font-semibold truncate">{data.stationName}</div>
                {data.stationAddress && (
                  <div className={`text-xs truncate ${textSub}`}>{data.stationAddress}</div>
                )}
              </div>
            </div>

            <div className={`h-px my-3 ${isDarkMode ? "bg-gray-700/50" : "bg-gray-200"}`} />

            {/* Time Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-9 w-9 rounded-xl bg-blue-500/15 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div className={`text-xs font-medium ${textMuted}`}>Dauer</div>
                  <div className="text-sm font-semibold">
                    {hours > 0 ? `${hours} Std ` : ""}{mins} Min
                  </div>
                </div>
              </div>
              <div className={`text-xs text-right ${textSub}`}>
                {startTime} – {endTime}
              </div>
            </div>

            <div className={`h-px my-3 ${isDarkMode ? "bg-gray-700/50" : "bg-gray-200"}`} />

            {/* Cost Row */}
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-amber-500/15 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="flex-1">
                <div className={`text-xs font-medium ${textMuted}`}>Gesamtkosten</div>
                <div className="text-sm font-semibold">{data.totalPrice.toFixed(2)} €</div>
              </div>
            </div>
          </div>

          {/* Star Rating */}
          <div className="px-5 mt-5">
            <p className={`text-sm font-medium text-center mb-2 ${textSub}`}>
              Wie war dein Erlebnis?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setRating(star);
                    saveRating(star);
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform duration-150 hover:scale-110 active:scale-95 p-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill={(hoverRating || rating) >= star ? "#f59e0b" : "none"}
                    stroke={(hoverRating || rating) >= star ? "#f59e0b" : (isDarkMode ? "#4b5563" : "#d1d5db")}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-colors duration-150"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className={`text-xs text-center mt-1.5 ${textMuted}`}>
                {rating <= 2 ? "Danke für dein Feedback" : rating <= 4 ? "Schön, dass es gut war!" : "Super, das freut uns!"}
              </p>
            )}
          </div>

          {/* Issue Report */}
          {showIssueForm && !submitted && (
            <div className="px-5 mt-4">
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                placeholder="Beschreibe dein Problem..."
                rows={3}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                  isDarkMode
                    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-slate-900 placeholder-gray-400"
                }`}
              />
              <button
                onClick={submitIssue}
                disabled={submitting || !issueText.trim()}
                className="mt-2 w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {submitting ? "Wird gesendet..." : "Problem melden"}
              </button>
            </div>
          )}

          {submitted && (
            <div className="px-5 mt-4">
              <div className={`rounded-xl border px-4 py-3 text-center text-sm ${
                isDarkMode ? "bg-gray-800/60 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-slate-600"
              }`}>
                Dein Problem wurde gemeldet. Wir kümmern uns darum.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-5 mt-2 space-y-3 pb-8">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
            >
              Alles klar
            </button>

            {!showIssueForm && !submitted && (
              <button
                onClick={() => setShowIssueForm(true)}
                className={`w-full rounded-xl border py-3 text-sm font-medium transition-all active:scale-[0.98] ${
                  isDarkMode
                    ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                    : "border-gray-300 text-slate-600 hover:bg-gray-50"
                }`}
              >
                Problem melden
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
