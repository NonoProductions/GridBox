"use client";

import React, { useEffect, useState } from "react";
import { Station } from "./StationManager";
import AnalyticsDashboardV2 from "./AnalyticsDashboardV2";
import {
  DEFAULT_HELP_PAGE_SETTINGS,
  fetchHelpPageSettings,
  saveHelpPageSettings,
  type HelpFaqEntry,
  type HelpPageSettings,
} from "@/lib/helpPageContent";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Rental {
  id: string;
  station_id: string;
  total_price: number | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  powerbank_id?: string | null;
}

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

type Tab = "overview" | "stats" | "stations" | "users" | "transactions" | "analytics" | "help" | "settings";

type HelpSettingField =
  | "intro_title"
  | "intro_subtitle"
  | "support_email"
  | "support_phone"
  | "emergency_phone"
  | "live_chat_hours"
  | "website_url";

export interface V2ContentProps {
  isDarkMode: boolean;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;

  // Stations
  stations: Station[];
  filteredStations: Station[];
  selectedStation: Station | null;
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
  showOnlyConnected: boolean;
  setShowOnlyConnected: (v: boolean) => void;
  loading: boolean;

  // Station helpers
  isStationConnected: (s: Station) => boolean;
  countOccupiedSlots: (s: Station) => number;
  isSlotOccupied: (s: Station, slot: number) => boolean;
  getSlotData: (s: Station, slot: number) => { voltage: number | null; percentage: number | null; powerbankId: string | null };

  // Station actions
  updateStation: (id: string, updates: Partial<Station>) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  setShowAddStationForm: (v: boolean) => void;
  updatingStation: string | null;

  // Computed
  utilizationPercentage: number;
  totalOccupiedUnits: number;
  totalCapacity: number;
  totalAvailableUnits: number;
  averageBattery: number | null;
  connectedStationsCount: number;
  activeStationsCount: number;
  inactiveStationsCount: number;

  // Status
  lastUpdate: Date | null;
  realtimeActive: boolean;

  // Stats
  statsLoading: boolean;
  statsRevenue: { total: number; monthTotal: number; count: number; avg: number; avgPerDay: number };
  statsTimeRangeDays: 7 | 14 | 30 | 90;
  setStatsTimeRangeDays: (d: 7 | 14 | 30 | 90) => void;
  revenueByDayData: Array<{ date: string; revenue: number }>;
  rentalsByDayData: Array<{ date: string; anzahl: number }>;
  revenueByStationData: Array<{ name: string; revenue: number }>;
  ownerRentals: Rental[];

  // Transactions
  txActiveCount: number;
  txTotalRevenue: number;
  txPagedRentals: Rental[];
  txPage: number;
  setTxPage: React.Dispatch<React.SetStateAction<number>>;
  txPageSize: number;
  setTxPageSize: (s: number) => void;
  txTotalPages: number;
  txStatusFilter: "all" | "active" | "completed";
  setTxStatusFilter: (f: "all" | "active" | "completed") => void;
  txSearchQuery: string;
  setTxSearchQuery: (q: string) => void;
  txStationFilter: string;
  setTxStationFilter: (f: string) => void;
  filteredRentals: Rental[];
  stationMap: Map<string, string>;

  // Users
  users: UserWithRole[];
  usersLoading: boolean;
  usersSearchQuery: string;
  usersPage: number;
  usersPageSize: number;
  usersTotalCount: number | null;
  usersRoleFilter: "all" | "owner" | "admin" | "user";
  fetchUsers: (opts?: { search?: string; page?: number; pageSize?: number; role?: string }) => Promise<void>;
  setUsersSearchQuery: (q: string) => void;
  setUsersPage: (p: number) => void;
  assignUserRole: (userId: string, role: "owner" | "user") => Promise<void>;

  // Render props for complex sub-components
  renderStationPhotos?: (station: Station) => React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function OwnerDashboardV2Content(p: V2ContentProps) {
  const dk = p.isDarkMode;

  // Style tokens
  const text = dk ? "text-neutral-100" : "text-neutral-900";
  const textMuted = dk ? "text-neutral-400" : "text-neutral-500";
  const textDim = dk ? "text-neutral-500" : "text-neutral-400";
  const border = dk ? "border-neutral-800" : "border-neutral-200";
  const rowHover = dk ? "hover:bg-white/[0.03]" : "hover:bg-neutral-50";
  const inputCls = cls(
    "w-full px-3 py-1.5 rounded-md border text-sm",
    dk ? "bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500" : "bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400",
    "focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500"
  );
  const btnPrimary = "px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors";
  const btnGhost = cls(
    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
    dk ? "text-neutral-300 hover:bg-neutral-800" : "text-neutral-600 hover:bg-neutral-100"
  );
  const chipActive = cls(
    "px-2.5 py-1 rounded-md text-xs font-medium",
    dk ? "bg-neutral-700 text-white" : "bg-neutral-900 text-white"
  );
  const chipInactive = cls(
    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
    dk ? "text-neutral-400 hover:bg-neutral-800" : "text-neutral-500 hover:bg-neutral-100"
  );

  const [helpSettings, setHelpSettings] = useState<HelpPageSettings>(DEFAULT_HELP_PAGE_SETTINGS);
  const [helpSettingsLoading, setHelpSettingsLoading] = useState(false);
  const [helpSettingsSaving, setHelpSettingsSaving] = useState(false);
  const [helpSettingsError, setHelpSettingsError] = useState<string | null>(null);
  const [helpSettingsSuccess, setHelpSettingsSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (p.activeTab !== "help") {
      return;
    }

    let cancelled = false;

    setHelpSettingsLoading(true);
    setHelpSettingsError(null);
    setHelpSettingsSuccess(null);

    (async () => {
      try {
        const settings = await fetchHelpPageSettings();
        if (!cancelled) {
          setHelpSettings(settings);
        }
      } catch (error) {
        if (!cancelled) {
          setHelpSettingsError("Die Hilfeseite konnte nicht geladen werden. Es werden die Standardwerte verwendet.");
        }
      } finally {
        if (!cancelled) {
          setHelpSettingsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [p.activeTab]);

  const updateHelpSetting = (field: HelpSettingField, value: string) => {
    setHelpSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateHelpFaq = (index: number, field: keyof HelpFaqEntry, value: string) => {
    setHelpSettings((current) => ({
      ...current,
      faqs: current.faqs.map((faq, faqIndex) => (faqIndex === index ? { ...faq, [field]: value } : faq)),
    }));
  };

  const addHelpFaq = () => {
    setHelpSettings((current) => ({
      ...current,
      faqs: [...current.faqs, { question: "", answer: "" }].slice(0, 12),
    }));
  };

  const removeHelpFaq = (index: number) => {
    setHelpSettings((current) => ({
      ...current,
      faqs: current.faqs.filter((_, faqIndex) => faqIndex !== index),
    }));
  };

  const saveHelpSettings = async () => {
    setHelpSettingsError(null);
    setHelpSettingsSuccess(null);

    const faqs = helpSettings.faqs
      .map((faq) => ({
        question: faq.question.trim(),
        answer: faq.answer.trim(),
      }))
      .filter((faq) => faq.question.length > 0 && faq.answer.length > 0)
      .slice(0, 12);

    if (faqs.length === 0) {
      setHelpSettingsError("Mindestens eine FAQ mit Frage und Antwort ist erforderlich.");
      return;
    }

    const payload: HelpPageSettings = {
      ...helpSettings,
      faqs,
    };

    setHelpSettingsSaving(true);
    try {
      await saveHelpPageSettings(payload);
      setHelpSettings(payload);
      setHelpSettingsSuccess("Hilfeseite gespeichert. Die öffentliche Seite wurde aktualisiert.");
    } catch (error) {
      setHelpSettingsError(error instanceof Error ? error.message : "Fehler beim Speichern der Hilfeseite.");
    } finally {
      setHelpSettingsSaving(false);
    }
  };

  // ── Overview Tab ─────────────────────────────────────────────────────────────

  const renderOverview = () => {
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Status */}
        <div className={cls("flex items-center gap-3 text-sm tabular-nums", textDim)}>
          <span className="flex items-center gap-1.5">
            <span className={cls("inline-block w-2 h-2 rounded-full", p.realtimeActive ? "bg-emerald-500" : dk ? "bg-neutral-600" : "bg-neutral-300")} />
            {p.realtimeActive ? "Live" : "Offline"}
          </span>
          {p.lastUpdate && (
            <>
              <span className={dk ? "text-neutral-700" : "text-neutral-300"}>·</span>
              <span>{p.lastUpdate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </>
          )}
        </div>

        {/* Metrics — 4 cols on desktop, 2 on mobile */}
        <div className={cls("grid grid-cols-2 lg:grid-cols-4 gap-4")}>
          {[
            { val: `${p.utilizationPercentage}%`, label: "Auslastung", sub: `${p.totalOccupiedUnits} / ${p.totalCapacity} Slots` },
            { val: `${p.stations.length}`, label: "Stationen", sub: `${p.connectedStationsCount} online` },
            { val: `${p.totalOccupiedUnits}`, label: "Powerbanks", sub: `${p.totalAvailableUnits} frei` },
            { val: p.averageBattery !== null ? `${p.averageBattery}%` : "—", label: "Batterie", sub: "Durchschnitt" },
          ].map((m, i) => (
            <div key={i} className={cls("rounded-lg border px-5 py-4", border)}>
              <div className={cls("text-4xl font-bold tracking-tight tabular-nums", text)}>{m.val}</div>
              <div className={cls("text-sm font-medium mt-1", textMuted)}>{m.label}</div>
              <div className={cls("text-xs mt-0.5", textDim)}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Active rentals */}
        {p.txActiveCount > 0 && (
          <button onClick={() => p.setActiveTab("transactions")}
            className={cls("w-full flex items-center justify-between px-5 py-3 rounded-lg text-sm transition-colors",
              dk ? "bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.12]" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80"
            )}>
            <span className="font-medium text-base">{p.txActiveCount} aktive Ausleihe{p.txActiveCount !== 1 ? "n" : ""}</span>
            <span className={cls("text-sm", dk ? "text-emerald-500/60" : "text-emerald-600/50")}>Details &rarr;</span>
          </button>
        )}

        {/* Station list */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className={cls("text-sm font-semibold", text)}>Stationen</h3>
            <button onClick={() => p.setActiveTab("stations")}
              className={cls("text-sm transition-colors", dk ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400 hover:text-neutral-600")}>
              Alle ({p.stations.length}) &rarr;
            </button>
          </div>

          {p.stations.length === 0 ? (
            <p className={cls("text-sm py-6", textDim)}>Keine Stationen vorhanden.</p>
          ) : (
            <div className={cls("rounded-lg border overflow-hidden", border)}>
              {/* Table header */}
              <div className={cls("grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2 text-xs font-medium uppercase tracking-wider",
                textDim, dk ? "bg-neutral-900/50" : "bg-neutral-50"
              )}>
                <span className="w-4"></span>
                <span>Name</span>
                <span className="w-14 text-right">Slots</span>
                <span className="w-14 text-right">Batt.</span>
              </div>
              {p.stations.slice(0, 8).map((station) => {
                const occupied = p.countOccupiedSlots(station);
                const total = station.total_units ?? 0;
                const connected = p.isStationConnected(station);
                const batts: number[] = [];
                for (let i = 1; i <= total; i++) {
                  if (p.isSlotOccupied(station, i)) {
                    const d = p.getSlotData(station, i);
                    if (d.percentage != null) batts.push(d.percentage);
                  }
                }
                const avgBatt = batts.length > 0 ? Math.round(batts.reduce((a, b) => a + b, 0) / batts.length) : null;
                return (
                  <div key={station.id} className={cls("grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center px-4 py-3 border-t", border, rowHover, "transition-colors")}>
                    <span className={cls("shrink-0 w-2.5 h-2.5 rounded-full", connected ? "bg-emerald-500" : dk ? "bg-neutral-700" : "bg-neutral-300")} />
                    <div className="min-w-0">
                      <span className={cls("text-sm font-medium truncate block", text)}>{station.name}</span>
                      {!station.is_active && <span className={cls("text-xs", dk ? "text-red-400/70" : "text-red-500/70")}>Pausiert</span>}
                    </div>
                    <span className={cls("text-sm font-medium tabular-nums w-14 text-right", textMuted)}>{occupied}/{total}</span>
                    <span className={cls("text-sm tabular-nums w-14 text-right",
                      avgBatt !== null && avgBatt < 30 ? (dk ? "text-red-400" : "text-red-500") : textDim
                    )}>{avgBatt !== null ? `${avgBatt}%` : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className={cls("pt-4 border-t flex gap-8 text-sm", border, textDim)}>
          <span>{p.activeStationsCount} aktiv</span>
          <span>{p.inactiveStationsCount} inaktiv</span>
          <span>{p.connectedStationsCount} verbunden</span>
        </div>
      </div>
    );
  };

  // ── Stats Tab ────────────────────────────────────────────────────────────────

  // Recharts tooltip style
  const tooltipStyle = {
    borderRadius: "8px",
    border: "none",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
    backgroundColor: dk ? "#262626" : "#fff",
    color: dk ? "#f5f5f5" : "#0a0a0a",
    fontSize: 12,
  };
  const gridStroke = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = dk ? "#525252" : "#a3a3a3";

  const renderStats = () => {
    if (p.stations.length === 0) {
      return <p className={cls("p-5 text-sm", textDim)}>Keine Statistiken verfügbar.</p>;
    }

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* Time range */}
        <div className="flex gap-1">
          {([7, 14, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => p.setStatsTimeRangeDays(d)}
              className={p.statsTimeRangeDays === d ? chipActive : chipInactive}>
              {d}T
            </button>
          ))}
        </div>

        {/* Revenue hero */}
        <div>
          <div className={cls("text-sm font-medium mb-1", textMuted)}>
            Einnahmen — {p.statsTimeRangeDays} Tage
          </div>
          <div className={cls("text-5xl font-bold tracking-tight tabular-nums", text)}>
            {p.statsLoading ? "…" : `${p.statsRevenue.total.toFixed(2)} €`}
          </div>
          <div className={cls("flex gap-8 mt-3 text-sm", textMuted)}>
            <span><span className={cls("font-semibold", text)}>{p.statsLoading ? "…" : `${p.statsRevenue.avgPerDay.toFixed(2)} €`}</span> / Tag</span>
            <span><span className={cls("font-semibold", text)}>{p.statsLoading ? "…" : p.statsRevenue.count}</span> Ausleihen</span>
            <span><span className={cls("font-semibold", text)}>{p.statsLoading ? "…" : p.statsRevenue.count > 0 ? `${p.statsRevenue.avg.toFixed(2)} €` : "—"}</span> / Ausleihe</span>
          </div>
        </div>

        {/* Revenue per day — recharts LineChart */}
        <div>
          <h3 className={cls("text-sm font-semibold mb-3", text)}>Einnahmen pro Tag</h3>
          <div className={cls("rounded-lg border p-4", border)}>
            {p.revenueByDayData.some((d) => d.revenue > 0) ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={p.revenueByDayData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={axisColor} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke={axisColor} tickFormatter={(v) => `${v}€`} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => [`${value != null ? value.toFixed(2) : "0"} €`, "Einnahmen"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={cls("h-[220px] flex items-center justify-center text-sm", textDim)}>
                Keine Einnahmen im Zeitraum
              </div>
            )}
          </div>
        </div>

        {/* Rentals per day — recharts BarChart */}
        <div>
          <h3 className={cls("text-sm font-semibold mb-3", text)}>Ausleihen pro Tag</h3>
          <div className={cls("rounded-lg border p-4", border)}>
            {p.rentalsByDayData.some((d) => d.anzahl > 0) ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.rentalsByDayData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={axisColor} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke={axisColor} allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value ?? 0, "Ausleihen"]} />
                    <Bar dataKey="anzahl" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={cls("h-[200px] flex items-center justify-center text-sm", textDim)}>
                Keine Ausleihen im Zeitraum
              </div>
            )}
          </div>
        </div>

        {/* Revenue per station */}
        {p.revenueByStationData.length > 0 && (
          <div>
            <h3 className={cls("text-sm font-semibold mb-3", text)}>Einnahmen pro Station</h3>
            <div className={cls("rounded-lg border overflow-hidden", border)}>
              {p.revenueByStationData.map((entry, i) => {
                const maxS = p.revenueByStationData[0]?.revenue ?? 1;
                const pct = maxS > 0 ? (entry.revenue / maxS) * 100 : 0;
                return (
                  <div key={i} className={cls("flex items-center gap-4 px-4 py-3 border-b last:border-0", border, rowHover, "transition-colors")}>
                    <span className={cls("text-sm font-medium flex-1 truncate", text)}>{entry.name}</span>
                    <div className={cls("w-32 h-1.5 rounded-full shrink-0", dk ? "bg-neutral-800" : "bg-neutral-100")}>
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className={cls("text-sm font-semibold tabular-nums shrink-0 w-24 text-right", text)}>
                      {entry.revenue.toFixed(2)} €
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent rentals */}
        {p.ownerRentals.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className={cls("text-sm font-semibold", text)}>Letzte Ausleihen</h3>
              <button onClick={() => p.setActiveTab("transactions")}
                className={cls("text-sm transition-colors", dk ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400 hover:text-neutral-600")}>
                Alle anzeigen &rarr;
              </button>
            </div>
            <div className={cls("rounded-lg border overflow-hidden", border)}>
              {p.ownerRentals.slice(0, 5).map((r) => {
                const name = p.stations.find((s) => s.id === r.station_id)?.name ?? "—";
                const date = new Date(r.started_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
                const isActive = r.status === "active" || !r.ended_at;
                return (
                  <div key={r.id} className={cls("flex items-center gap-3 px-4 py-3 border-b last:border-0", border, rowHover, "transition-colors")}>
                    <span className={cls("w-2 h-2 rounded-full shrink-0", isActive ? "bg-sky-500" : dk ? "bg-neutral-700" : "bg-neutral-300")} />
                    <span className={cls("text-sm font-medium flex-1 truncate", text)}>{name}</span>
                    <span className={cls("text-sm shrink-0", textDim)}>{date}</span>
                    <span className={cls("text-sm font-semibold tabular-nums shrink-0 w-20 text-right", text)}>
                      {r.total_price != null ? `${r.total_price.toFixed(2)} €` : <span className={cls("text-xs font-normal", dk ? "text-sky-400" : "text-sky-600")}>aktiv</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Stations Tab ─────────────────────────────────────────────────────────────

  const renderStations = () => {
    const sel = p.selectedStation;

    return (
      <div className="h-full flex flex-col">
        <div className="px-5 py-3 space-y-3">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className={cls("flex items-center gap-2 text-sm", textMuted)}>
              <span className={cls("font-semibold tabular-nums", text)}>{p.stations.length}</span> Stationen
              <span className={textDim}>·</span>
              <span className={cls("w-1.5 h-1.5 rounded-full inline-block", p.connectedStationsCount > 0 ? "bg-emerald-500" : dk ? "bg-neutral-600" : "bg-neutral-300")} />
              <span className="tabular-nums">{p.connectedStationsCount}</span> online
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => p.setShowOnlyConnected(!p.showOnlyConnected)}
                className={p.showOnlyConnected ? chipActive : chipInactive}>
                {p.showOnlyConnected ? "Alle zeigen" : "Nur online"}
              </button>
              <button onClick={() => p.setShowAddStationForm(true)} className={btnPrimary}>
                + Station
              </button>
            </div>
          </div>

          {/* Station pills */}
          {p.filteredStations.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {p.filteredStations.map((s) => {
                const connected = p.isStationConnected(s);
                const isSel = p.selectedStationId === s.id;
                return (
                  <button key={s.id} onClick={() => p.setSelectedStationId(s.id)}
                    className={cls("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      isSel ? (dk ? "bg-neutral-700 text-white" : "bg-neutral-900 text-white") : (dk ? "text-neutral-300 hover:bg-neutral-800" : "text-neutral-600 hover:bg-neutral-100")
                    )}>
                    <span className={cls("w-1.5 h-1.5 rounded-full shrink-0", connected ? "bg-emerald-500" : dk ? "bg-neutral-600" : "bg-neutral-300")} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Station detail */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {p.loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : !sel ? (
            <p className={cls("text-sm py-8", textDim)}>
              {p.filteredStations.length === 0
                ? (p.showOnlyConnected ? "Keine online-Stationen." : "Noch keine Stationen.")
                : "Station auswählen."}
            </p>
          ) : (
            <div className="space-y-4">

              {/* Header */}
              <div className={cls("border-b pb-4", border)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className={cls("text-lg font-semibold", text)}>{sel.name}</h4>
                    <div className={cls("flex items-center gap-3 mt-1 text-xs", textDim)}>
                      <span className="flex items-center gap-1">
                        <span className={cls("w-1.5 h-1.5 rounded-full", p.isStationConnected(sel) ? "bg-emerald-500" : dk ? "bg-neutral-600" : "bg-neutral-300")} />
                        {p.isStationConnected(sel) ? "Online" : "Offline"}
                      </span>
                      <span>{sel.is_active ? "Aktiv" : "Inaktiv"}</span>
                      {sel.short_code && <span className="font-mono">{sel.short_code}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => p.updateStation(sel.id, { is_active: !sel.is_active })}
                    disabled={p.updatingStation === sel.id}
                    className={cls("shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      p.updatingStation === sel.id ? "opacity-50 cursor-not-allowed" : "",
                      sel.is_active
                        ? (dk ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50")
                        : (dk ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50")
                    )}>
                    {p.updatingStation === sel.id ? "…" : (sel.is_active ? "Deaktivieren" : "Aktivieren")}
                  </button>
                </div>

                {/* Capacity */}
                <div className={cls("flex items-center gap-4 mt-3 text-sm", textMuted)}>
                  <span>Belegt: <span className={cls("font-semibold tabular-nums", text)}>{p.countOccupiedSlots(sel)}/{sel.total_units ?? 0}</span></span>
                  <span className="flex items-center gap-2">
                    Slots:
                    <input type="number" min="1" max="32"
                      value={sel.total_units ?? 2}
                      onChange={(e) => p.updateStation(sel.id, { total_units: parseInt(e.target.value) || 1 })}
                      className={cls("w-14 px-2 py-0.5 rounded-md border text-sm font-medium text-center tabular-nums",
                        dk ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-neutral-900",
                        "focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                      )}
                    />
                  </span>
                </div>
              </div>

              {/* Slots */}
              <div>
                <h5 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Slots</h5>
                {(sel.total_units ?? 0) > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Array.from({ length: sel.total_units ?? 0 }, (_, idx) => {
                      const slot = idx + 1;
                      const occ = p.isSlotOccupied(sel, slot);
                      const data = p.getSlotData(sel, slot);
                      const pct = data.percentage;
                      const battColor = pct == null ? null : pct < 20 ? "text-red-500" : pct < 50 ? (dk ? "text-yellow-400" : "text-yellow-600") : (dk ? "text-emerald-400" : "text-emerald-600");
                      return (
                        <div key={slot} className={cls("rounded-md border px-3 py-2", border,
                          occ ? (dk ? "bg-neutral-900/50" : "bg-white") : (dk ? "bg-neutral-900/20" : "bg-neutral-50")
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={cls("text-[11px] font-medium", textDim)}>Slot {slot}</span>
                            <span className={cls("w-1.5 h-1.5 rounded-full", occ ? "bg-emerald-500" : dk ? "bg-neutral-700" : "bg-neutral-200")} />
                          </div>
                          {occ ? (
                            <>
                              {pct != null && <div className={cls("text-sm font-semibold tabular-nums", battColor)}>{pct}%</div>}
                              {data.voltage != null && <div className={cls("text-[11px] tabular-nums", textDim)}>{data.voltage.toFixed(2)} V</div>}
                              {data.powerbankId && <div className={cls("text-[11px] font-mono truncate mt-0.5", textDim)}>{data.powerbankId}</div>}
                            </>
                          ) : (
                            <div className={cls("text-[11px]", dk ? "text-neutral-700" : "text-neutral-300")}>Leer</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={cls("text-sm", textDim)}>Keine Slots konfiguriert.</p>
                )}
              </div>

              {/* Photos */}
              {p.renderStationPhotos && (
                <div>
                  <h5 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Fotos</h5>
                  {p.renderStationPhotos(sel)}
                </div>
              )}

              {/* Opening hours */}
              <div>
                <h5 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Öffnungszeiten</h5>
                <textarea
                  value={sel.opening_hours || ""}
                  onChange={(e) => p.updateStation(sel.id, { opening_hours: e.target.value })}
                  placeholder="z.B. Mo–Fr: 8–18 Uhr"
                  rows={2}
                  className={cls(inputCls, "resize-none")}
                />
              </div>

              {/* Actions */}
              <div className={cls("flex items-center justify-between gap-3 pt-3 border-t", border)}>
                <button
                  onClick={() => p.updateStation(sel.id, { charge_enabled: !(sel.charge_enabled ?? true) })}
                  disabled={p.updatingStation === sel.id}
                  className={cls("text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                    p.updatingStation === sel.id ? "opacity-50" : "",
                    !(sel.charge_enabled ?? true)
                      ? (dk ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-700 hover:bg-emerald-50")
                      : (dk ? "text-neutral-400 hover:bg-neutral-800" : "text-neutral-500 hover:bg-neutral-100")
                  )}>
                  Laden {!(sel.charge_enabled ?? true) ? "EIN" : "AUS"}
                </button>
                <button
                  onClick={() => p.deleteStation(sel.id)}
                  className={cls("text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                    dk ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50"
                  )}>
                  Löschen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Transactions Tab ─────────────────────────────────────────────────────────

  const renderTransactions = () => {
    return (
      <div className="h-full flex flex-col">
        {/* Header + Filters */}
        <div className={cls("px-5 py-3 border-b space-y-3", border)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className={cls("text-sm", textMuted)}>
              <span className={cls("font-semibold", text)}>Transaktionen</span>
              {p.filteredRentals.length > 0 && <span className="ml-1.5">({p.filteredRentals.length})</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className={cls("text-sm font-semibold tabular-nums", dk ? "text-emerald-400" : "text-emerald-600")}>
                {p.txTotalRevenue.toFixed(2)} €
              </span>
              {p.txActiveCount > 0 && (
                <span className={cls("text-xs tabular-nums", dk ? "text-yellow-400" : "text-yellow-600")}>
                  {p.txActiveCount} aktiv
                </span>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px] sm:flex-initial">
              <input type="search" value={p.txSearchQuery}
                onChange={(e) => { p.setTxSearchQuery(e.target.value); p.setTxPage(1); }}
                placeholder="Suchen…"
                className={cls(inputCls, "pl-7 !w-full sm:!w-44")}
              />
              <svg className={cls("absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none", textDim)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <div className="flex gap-1">
              {(["all", "active", "completed"] as const).map((s) => (
                <button key={s} onClick={() => { p.setTxStatusFilter(s); p.setTxPage(1); }}
                  className={p.txStatusFilter === s ? chipActive : chipInactive}>
                  {s === "all" ? "Alle" : s === "active" ? "Aktiv" : "Fertig"}
                </button>
              ))}
            </div>
            {p.stations.length > 1 && (
              <select value={p.txStationFilter}
                onChange={(e) => { p.setTxStationFilter(e.target.value); p.setTxPage(1); }}
                className={cls("px-2 py-1 rounded-md border text-xs", dk ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-neutral-700")}>
                <option value="all">Alle Stationen</option>
                {p.stations.map((s) => s.id && <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {/* Pagination */}
            <div className="flex items-center gap-1 ml-auto">
              <select value={p.txPageSize}
                onChange={(e) => { p.setTxPageSize(Number(e.target.value)); p.setTxPage(1); }}
                className={cls("px-1.5 py-1 rounded-md border text-xs", dk ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-neutral-700")}>
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={() => p.setTxPage((pg: number) => Math.max(1, pg - 1))} disabled={p.txPage <= 1}
                className={cls("p-1 rounded transition-colors disabled:opacity-30", dk ? "hover:bg-neutral-800" : "hover:bg-neutral-100")}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className={cls("text-xs tabular-nums min-w-[50px] text-center", textDim)}>{p.txPage}/{p.txTotalPages}</span>
              <button onClick={() => p.setTxPage((pg: number) => Math.min(p.txTotalPages, pg + 1))} disabled={p.txPage >= p.txTotalPages}
                className={cls("p-1 rounded transition-colors disabled:opacity-30", dk ? "hover:bg-neutral-800" : "hover:bg-neutral-100")}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {p.statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : p.txPagedRentals.length === 0 ? (
            <p className={cls("text-sm p-5", textDim)}>
              {p.ownerRentals.length === 0 ? "Keine Transaktionen." : "Keine Treffer."}
            </p>
          ) : (
            <div className={cls("divide-y", dk ? "divide-neutral-800" : "divide-neutral-100")}>
              {/* Table header */}
              <div className={cls("grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-5 py-2 text-[11px] font-medium uppercase tracking-wider", textDim)}>
                <span className="w-12">Status</span>
                <span>Station</span>
                <span className="hidden sm:block w-32">Zeit</span>
                <span className="hidden sm:block w-16">Dauer</span>
                <span className="w-16 text-right">Betrag</span>
              </div>
              {p.txPagedRentals.map((r) => {
                const name = p.stationMap.get(r.station_id ?? "") ?? "—";
                const isActive = r.status === "active" || !r.ended_at;
                const start = new Date(r.started_at);
                const end = r.ended_at ? new Date(r.ended_at) : null;
                const durMs = end ? end.getTime() - start.getTime() : Date.now() - start.getTime();
                const durMin = Math.floor(durMs / 60000);
                const durStr = durMin < 60 ? `${durMin}m` : `${Math.floor(durMin / 60)}h ${durMin % 60}m`;
                return (
                  <div key={r.id} className={cls("grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-5 py-2.5 items-center", rowHover, "transition-colors")}>
                    <span className="w-12">
                      <span className={cls("inline-flex items-center gap-1 text-[11px] font-medium",
                        isActive ? (dk ? "text-yellow-400" : "text-yellow-600") : (dk ? "text-emerald-400" : "text-emerald-600")
                      )}>
                        <span className={cls("w-1.5 h-1.5 rounded-full", isActive ? "bg-yellow-500" : "bg-emerald-500")} />
                        {isActive ? "Aktiv" : "Fertig"}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <span className={cls("text-sm truncate block", text)}>{name}</span>
                      {r.powerbank_id && <span className={cls("text-[11px] font-mono", textDim)}>{r.powerbank_id}</span>}
                    </div>
                    <span className={cls("hidden sm:block w-32 text-xs tabular-nums", textDim)}>
                      {start.toLocaleDateString("de-DE")} {start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={cls("hidden sm:block w-16 text-xs tabular-nums", isActive ? (dk ? "text-yellow-400" : "text-yellow-600") : textDim)}>
                      {durStr}
                    </span>
                    <span className={cls("w-16 text-right text-sm font-medium tabular-nums",
                      r.total_price != null ? text : textDim
                    )}>
                      {r.total_price != null ? `${r.total_price.toFixed(2)} €` : "–"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Users Tab ────────────────────────────────────────────────────────────────

  const renderUsers = () => {
    const totalPages = p.usersTotalCount != null ? Math.ceil(p.usersTotalCount / p.usersPageSize) || 1 : 1;

    return (
      <div className="h-full flex flex-col">
        {/* Header + Filters */}
        <div className={cls("px-5 py-3 border-b space-y-3", border)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className={cls("text-sm", textMuted)}>
              <span className={cls("font-semibold", text)}>Benutzer</span>
              {p.usersTotalCount != null && <span className="ml-1.5">({p.usersTotalCount})</span>}
            </div>
            <div className="relative flex-1 sm:flex-initial min-w-[160px] sm:max-w-[220px]">
              <input type="search" value={p.usersSearchQuery}
                onChange={(e) => {
                  p.setUsersSearchQuery(e.target.value);
                  p.setUsersPage(1);
                  p.fetchUsers({ search: e.target.value, page: 1 });
                }}
                placeholder="E-Mail suchen…"
                className={cls(inputCls, "pl-7")}
              />
              <svg className={cls("absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none", textDim)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["all", "user", "admin", "owner"] as const).map((r) => (
                <button key={r} onClick={() => p.fetchUsers({ role: r, page: 1 })}
                  className={p.usersRoleFilter === r ? chipActive : chipInactive}>
                  {r === "all" ? "Alle" : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <select value={p.usersPageSize}
                onChange={(e) => p.fetchUsers({ pageSize: Number(e.target.value), page: 1 })}
                className={cls("px-1.5 py-1 rounded-md border text-xs", dk ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-neutral-300 text-neutral-700")}>
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={() => p.fetchUsers({ page: p.usersPage - 1 })} disabled={p.usersLoading || p.usersPage <= 1}
                className={cls("p-1 rounded transition-colors disabled:opacity-30", dk ? "hover:bg-neutral-800" : "hover:bg-neutral-100")}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className={cls("text-xs tabular-nums min-w-[50px] text-center", textDim)}>{p.usersPage}/{totalPages}</span>
              <button onClick={() => p.fetchUsers({ page: p.usersPage + 1 })}
                disabled={p.usersLoading || (p.usersTotalCount != null && p.usersPage * p.usersPageSize >= p.usersTotalCount)}
                className={cls("p-1 rounded transition-colors disabled:opacity-30", dk ? "hover:bg-neutral-800" : "hover:bg-neutral-100")}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {p.usersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : p.users.length === 0 ? (
            <p className={cls("text-sm p-5", textDim)}>
              {p.usersSearchQuery.trim() || p.usersRoleFilter !== "all" ? "Keine Treffer." : "Keine Benutzer."}
            </p>
          ) : (
            <div className={cls("divide-y", dk ? "divide-neutral-800" : "divide-neutral-100")}>
              {/* Header */}
              <div className={cls("grid grid-cols-[2rem_1fr_auto_auto] gap-x-4 px-5 py-2 text-[11px] font-medium uppercase tracking-wider", textDim)}>
                <span></span>
                <span>E-Mail</span>
                <span className="hidden sm:block w-20">Datum</span>
                <span className="w-24 text-right">Rolle</span>
              </div>
              {p.users.map((user) => {
                const initials = (user.email || "?").slice(0, 2).toUpperCase();
                const roleColor = user.role === "owner"
                  ? (dk ? "text-purple-400" : "text-purple-600")
                  : user.role === "admin"
                    ? (dk ? "text-blue-400" : "text-blue-600")
                    : textDim;
                return (
                  <div key={user.user_id} className={cls("grid grid-cols-[2rem_1fr_auto_auto] gap-x-4 px-5 py-2.5 items-center", rowHover, "transition-colors")}>
                    <div className={cls("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                      dk ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-600"
                    )}>{initials}</div>
                    <div className="min-w-0">
                      <span className={cls("text-sm truncate block", text)}>{user.email}</span>
                      <span className={cls("text-[11px] sm:hidden", textDim)}>
                        {new Date(user.created_at).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    <span className={cls("hidden sm:block w-20 text-xs", textDim)}>
                      {new Date(user.created_at).toLocaleDateString("de-DE")}
                    </span>
                    <div className="w-24 flex items-center justify-end gap-1.5">
                      <span className={cls("text-xs font-medium", roleColor)}>{user.role}</span>
                      {user.role !== "owner" && (
                        <div className="flex gap-0.5">
                          <button onClick={() => p.assignUserRole(user.user_id, "owner")} title="Zu Owner"
                            className={cls("p-1 rounded transition-colors", dk ? "hover:bg-purple-500/15 text-purple-400" : "hover:bg-purple-50 text-purple-600")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          </button>
                          {user.role !== "user" && (
                            <button onClick={() => p.assignUserRole(user.user_id, "user")} title="Zu User"
                              className={cls("p-1 rounded transition-colors", dk ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-500")}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h3 className={cls("text-xl font-semibold", text)}>Einstellungen Hilfeseite</h3>
          <p className={cls("text-sm mt-1", textDim)}>
            Dieser Bereich ist die Eingabe fur die offentliche Hilfeseite. Telefonnummern, Inhalte und Fragen (FAQ) kannst du hier direkt andern.
          </p>
        </div>

        {helpSettingsError && (
          <div className={cls("rounded-lg border px-3 py-2.5 text-sm", dk ? "border-red-900/50 bg-red-950/40 text-red-400" : "border-red-200 bg-red-50 text-red-600")}>
            {helpSettingsError}
          </div>
        )}

        {helpSettingsSuccess && (
          <div className={cls("rounded-lg border px-3 py-2.5 text-sm", dk ? "border-emerald-900/50 bg-emerald-950/40 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-600")}>
            {helpSettingsSuccess}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className={cls("rounded-2xl border overflow-hidden", border)}>
            <div className={cls("px-4 py-3 border-b", border)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className={cls("text-sm font-semibold", text)}>Hilfeseite bearbeiten</h4>
                  <p className={cls("text-xs mt-1", textDim)}>Änderungen erscheinen auf /hilfe nach dem Speichern.</p>
                </div>
                {helpSettingsLoading && (
                  <span className={cls("text-xs", textDim)}>Lädt…</span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Titel</span>
                  <input
                    type="text"
                    value={helpSettings.intro_title}
                    onChange={(e) => updateHelpSetting("intro_title", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Untertitel</span>
                  <input
                    type="text"
                    value={helpSettings.intro_subtitle}
                    onChange={(e) => updateHelpSetting("intro_subtitle", e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>E-Mail Support</span>
                  <input
                    type="email"
                    value={helpSettings.support_email}
                    onChange={(e) => updateHelpSetting("support_email", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Telefon Support</span>
                  <input
                    type="text"
                    value={helpSettings.support_phone}
                    onChange={(e) => updateHelpSetting("support_phone", e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Notfall-Support</span>
                  <input
                    type="text"
                    value={helpSettings.emergency_phone}
                    onChange={(e) => updateHelpSetting("emergency_phone", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Live-Chat Zeiten</span>
                  <input
                    type="text"
                    value={helpSettings.live_chat_hours}
                    onChange={(e) => updateHelpSetting("live_chat_hours", e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={cls("text-xs font-medium", textMuted)}>Website</span>
                  <input
                    type="text"
                    value={helpSettings.website_url}
                    onChange={(e) => updateHelpSetting("website_url", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <div className={cls("rounded-xl border p-3", dk ? "border-neutral-800 bg-neutral-900/30" : "border-neutral-200 bg-neutral-50")}>
                  <p className={cls("text-xs font-semibold uppercase tracking-wide", textDim)}>Hinweis</p>
                  <p className={cls("mt-1 text-xs leading-relaxed", textDim)}>
                    Maximal 12 FAQ-Einträge. Leere Einträge werden beim Speichern ignoriert.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h5 className={cls("text-sm font-semibold", text)}>FAQ</h5>
                  <button type="button" onClick={addHelpFaq} className={btnGhost}>
                    + FAQ hinzufügen
                  </button>
                </div>

                <div className="space-y-3">
                  {helpSettings.faqs.map((faq, index) => (
                    <div key={`${index}-${faq.question}`} className={cls("rounded-xl border p-3 space-y-3", border)}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={cls("text-xs font-medium", textMuted)}>FAQ {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeHelpFaq(index)}
                          className={cls("text-xs transition-colors", dk ? "text-red-400 hover:text-red-300" : "text-red-500 hover:text-red-600")}
                        >
                          Entfernen
                        </button>
                      </div>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateHelpFaq(index, "question", e.target.value)}
                        placeholder="Frage"
                        className={inputCls}
                      />
                      <textarea
                        value={faq.answer}
                        onChange={(e) => updateHelpFaq(index, "answer", e.target.value)}
                        placeholder="Antwort"
                        rows={4}
                        className={cls(inputCls, "resize-none")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={cls("px-4 py-3 border-t flex items-center justify-between gap-3", border, dk ? "bg-neutral-950/30" : "bg-neutral-50")}> 
              <p className={cls("text-xs leading-relaxed", textDim)}>
                Die Inhalte werden direkt für die öffentliche Hilfeseite verwendet.
              </p>
              <button
                type="button"
                onClick={saveHelpSettings}
                disabled={helpSettingsSaving || helpSettingsLoading}
                className={cls(btnPrimary, "disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                {helpSettingsSaving ? "Speichere…" : "Speichern"}
              </button>
            </div>
          </div>

          <div className={cls("rounded-2xl border overflow-hidden", border)}>
            <div className={cls("px-4 py-3 border-b", border)}>
              <h4 className={cls("text-sm font-semibold", text)}>Vorschau</h4>
              <p className={cls("text-xs mt-1", textDim)}>So erscheint die Seite für Nutzerinnen und Nutzer.</p>
            </div>

            <div className="p-4 space-y-4">
              <div className={cls("rounded-2xl p-4", dk ? "bg-white/5" : "bg-neutral-50") }>
                <p className={cls("text-xs uppercase tracking-wide font-semibold", textDim)}>Header</p>
                <h5 className={cls("mt-2 text-xl font-bold", text)}>{helpSettings.intro_title}</h5>
                <p className={cls("mt-1 text-sm", textDim)}>{helpSettings.intro_subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["E-Mail", helpSettings.support_email],
                  ["Telefon", helpSettings.support_phone],
                  ["Notfall", helpSettings.emergency_phone],
                  ["Chat", helpSettings.live_chat_hours],
                ].map(([label, value]) => (
                  <div key={label} className={cls("rounded-xl border p-3", border)}>
                    <p className={cls("text-[11px] uppercase tracking-wide font-semibold", textDim)}>{label}</p>
                    <p className={cls("mt-1 text-sm font-medium break-words", text)}>{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h6 className={cls("text-sm font-semibold mb-2", text)}>FAQ Vorschau</h6>
                <div className="space-y-2">
                  {helpSettings.faqs.slice(0, 3).map((faq, index) => (
                    <div key={`${faq.question}-${index}`} className={cls("rounded-xl border p-3", border)}>
                      <p className={cls("text-sm font-medium", text)}>{faq.question || "Unbenannte Frage"}</p>
                      <p className={cls("mt-1 text-xs leading-relaxed whitespace-pre-line", textDim)}>{faq.answer || "Keine Antwort hinterlegt."}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cls("rounded-xl border p-3 text-xs leading-relaxed", border)}>
                <p className={cls("font-semibold uppercase tracking-wide", textDim)}>Website</p>
                <p className={cls("mt-1", text)}>{helpSettings.website_url}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  switch (p.activeTab) {
    case "overview":
      return renderOverview();
    case "stats":
      return renderStats();
    case "stations":
      return renderStations();
    case "transactions":
      return renderTransactions();
    case "users":
      return renderUsers();
    case "analytics":
      return <AnalyticsDashboardV2 isDarkMode={dk} />;
    case "help":
      return renderSettings();
    default:
      return null;
  }
}
