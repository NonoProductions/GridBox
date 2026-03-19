"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalPageViews: number;
    uniqueSessions: number;
    uniqueUsers: number;
    avgDuration: number;
    bounceRate: number;
    days: number;
  };
  dailyData: Array<{ date: string; views: number; visitors: number }>;
  topPages: Array<{ path: string; views: number; avgDuration: number }>;
  topReferrers: Array<{ source: string; count: number }>;
  devices: Array<{ type: string; count: number; percentage: number }>;
  browsers: Array<{ name: string; count: number; percentage: number }>;
  operatingSystems: Array<{ name: string; count: number; percentage: number }>;
  countries: Array<{ name: string; count: number; percentage: number }>;
  hourlyData: Array<{ hour: string; views: number }>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const deviceLabels: Record<string, string> = {
  mobile: "Mobil",
  tablet: "Tablet",
  desktop: "Desktop",
  unbekannt: "Unbekannt",
};

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export default function AnalyticsDashboardV2({ isDarkMode }: { isDarkMode: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 90>(30);

  const dk = isDarkMode;
  const text = dk ? "text-neutral-100" : "text-neutral-900";
  const textMuted = dk ? "text-neutral-400" : "text-neutral-500";
  const textDim = dk ? "text-neutral-500" : "text-neutral-400";
  const border = dk ? "border-neutral-800" : "border-neutral-200";
  const rowHover = dk ? "hover:bg-white/[0.03]" : "hover:bg-neutral-50";
  const chipActive = cls("px-2.5 py-1 rounded-md text-xs font-medium", dk ? "bg-neutral-700 text-white" : "bg-neutral-900 text-white");
  const chipInactive = cls("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", dk ? "text-neutral-400 hover:bg-neutral-800" : "text-neutral-500 hover:bg-neutral-100");

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: dk ? "#262626" : "#fff",
    border: `1px solid ${dk ? "#404040" : "#e5e5e5"}`,
    borderRadius: 6,
    fontSize: 12,
    color: dk ? "#e5e5e5" : "#171717",
  };
  const gridStroke = dk ? "#333" : "#e5e5e5";
  const axisColor = dk ? "#666" : "#a3a3a3";

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError("Nicht authentifiziert"); return; }

      const res = await fetch(`/api/admin/analytics?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || `Fehler ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4 animate-pulse">
        <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className={cls("h-7 w-10 rounded-md", dk ? "bg-neutral-800" : "bg-neutral-100")} />)}</div>
        <div className={cls("grid grid-cols-2 lg:grid-cols-4 gap-px border rounded-lg overflow-hidden", border)}>
          {[1, 2, 3, 4].map((i) => <div key={i} className={cls("h-24", dk ? "bg-neutral-900" : "bg-neutral-50")} />)}
        </div>
        <div className={cls("h-[220px] rounded-lg", dk ? "bg-neutral-900" : "bg-neutral-50")} />
        <div className={cls("h-[160px] rounded-lg", dk ? "bg-neutral-900" : "bg-neutral-50")} />
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className={cls("h-8 rounded", dk ? "bg-neutral-900" : "bg-neutral-50")} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className={cls("text-sm rounded-lg border px-4 py-3", dk ? "border-red-900/40 text-red-400" : "border-red-200 text-red-600")}>
          <p className="font-medium mb-1">Fehler</p>
          <p className="text-xs">{error}</p>
          <button onClick={fetchAnalytics}
            className="mt-2 px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, dailyData, topPages, topReferrers, devices, browsers, operatingSystems, countries, hourlyData } = data;
  const peakHour = hourlyData.reduce((best, h) => (h.views > best.views ? h : best), hourlyData[0] || { hour: "0", views: 0 });

  // Format daily chart data with short date labels
  const chartDaily = dailyData.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
  }));

  // Format hourly chart data
  const chartHourly = hourlyData.map((h) => ({
    ...h,
    label: `${h.hour}:00`,
  }));

  // Bar helper for distribution sections
  const DistRow = ({ label, value, pct }: { label: string; value: string; pct: number }) => (
    <div className={cls("flex items-center gap-3 py-2 border-b", border)}>
      <span className={cls("text-sm flex-1 truncate", text)}>{label}</span>
      <div className={cls("w-24 h-1.5 rounded-full shrink-0", dk ? "bg-neutral-800" : "bg-neutral-100")}>
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <span className={cls("text-sm font-medium tabular-nums shrink-0 w-16 text-right", text)}>{value}</span>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">

      {/* Time range */}
      <div className="flex gap-1">
        {([7, 14, 30, 90] as const).map((d) => (
          <button key={d} onClick={() => setTimeRange(d)}
            className={timeRange === d ? chipActive : chipInactive}>
            {d}T
          </button>
        ))}
      </div>

      {/* Summary metrics 4-col */}
      <div className={cls("grid grid-cols-2 lg:grid-cols-4 gap-4")}>
        {[
          { val: formatNumber(summary.totalPageViews), label: "Seitenaufrufe", sub: `Letzte ${timeRange} Tage` },
          { val: formatNumber(summary.uniqueSessions), label: "Besucher", sub: `${summary.bounceRate}% Absprung` },
          { val: formatNumber(summary.uniqueUsers), label: "Eingeloggte User", sub: "Authentifiziert" },
          { val: formatDuration(summary.avgDuration), label: "Verweildauer", sub: `Peak ${peakHour.hour}:00` },
        ].map((m, i) => (
          <div key={i} className={cls("rounded-lg border px-5 py-4", border)}>
            <div className={cls("text-4xl font-bold tracking-tight tabular-nums", text)}>{m.val}</div>
            <div className={cls("text-sm font-medium mt-1", textMuted)}>{m.label}</div>
            <div className={cls("text-xs mt-0.5", textDim)}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Daily traffic — recharts AreaChart */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className={cls("text-xs font-medium uppercase tracking-wider", textDim)}>Aufrufe & Besucher</h3>
          <div className={cls("flex items-center gap-3 text-xs", textDim)}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Aufrufe</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500" /> Besucher</span>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartDaily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="areaVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="views" name="Aufrufe" stroke="#10b981" strokeWidth={2} fill="url(#areaViews)" dot={false} />
              <Area type="monotone" dataKey="visitors" name="Besucher" stroke="#0ea5e9" strokeWidth={2} fill="url(#areaVisitors)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly activity — recharts BarChart */}
      <div>
        <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-3", textDim)}>Aktivität nach Uhrzeit</h3>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartHourly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisColor }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="views" name="Aufrufe" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top pages */}
      <div>
        <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Top Seiten</h3>
        {topPages.length === 0 ? (
          <p className={cls("text-sm py-4", textDim)}>Noch keine Daten</p>
        ) : (
          <div className={cls("border-t", border)}>
            {topPages.map((page, i) => (
              <div key={i} className={cls("flex items-center gap-3 py-2 border-b", border, rowHover, "transition-colors")}>
                <span className={cls("text-sm flex-1 truncate font-mono", text)}>{page.path}</span>
                <span className={cls("text-xs shrink-0", textDim)}>{formatDuration(page.avgDuration)}</span>
                <span className={cls("text-sm font-medium tabular-nums shrink-0 w-12 text-right", text)}>{page.views}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referrers */}
      <div>
        <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Herkunft</h3>
        {topReferrers.length === 0 ? (
          <div className={cls("text-sm py-4", textDim)}>
            <p>Keine Referrer-Daten</p>
            <p className="text-xs mt-0.5">Direktaufrufe haben keinen Referrer</p>
          </div>
        ) : (
          <div className={cls("border-t", border)}>
            {topReferrers.map((ref, i) => (
              <div key={i} className={cls("flex items-center gap-3 py-2 border-b", border, rowHover, "transition-colors")}>
                <span className={cls("text-sm flex-1 truncate", text)}>{ref.source}</span>
                <span className={cls("text-sm font-medium tabular-nums shrink-0 w-12 text-right", text)}>{ref.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Devices */}
      <div>
        <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Geräte</h3>
        <div className={cls("border-t", border)}>
          {devices.map((d, i) => (
            <DistRow key={i} label={deviceLabels[d.type] || d.type} value={`${d.percentage}%`} pct={d.percentage} />
          ))}
        </div>
      </div>

      {/* Browser & OS side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Browser</h3>
          <div className={cls("border-t", border)}>
            {browsers.map((b, i) => <DistRow key={i} label={b.name} value={`${b.percentage}%`} pct={b.percentage} />)}
          </div>
        </div>
        <div>
          <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Betriebssysteme</h3>
          <div className={cls("border-t", border)}>
            {operatingSystems.map((os, i) => <DistRow key={i} label={os.name} value={`${os.percentage}%`} pct={os.percentage} />)}
          </div>
        </div>
      </div>

      {/* Countries */}
      {countries.length > 0 && !(countries.length === 1 && countries[0].name === "Unbekannt") && (
        <div>
          <h3 className={cls("text-xs font-medium uppercase tracking-wider mb-2", textDim)}>Länder</h3>
          <div className={cls("border-t", border)}>
            {countries.map((c, i) => (
              <DistRow key={i} label={c.name} value={`${c.count} (${c.percentage}%)`} pct={c.percentage} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={cls("text-xs pb-2", textDim)}>
        Letzte {timeRange} Tage · Keine Drittanbieter
      </div>
    </div>
  );
}
