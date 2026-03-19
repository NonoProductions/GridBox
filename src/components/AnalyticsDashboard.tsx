"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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

interface AnalyticsDashboardProps {
  isDarkMode: boolean;
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

export default function AnalyticsDashboard({ isDarkMode }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 90>(30);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError("Nicht authentifiziert");
        return;
      }

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
      <div className="p-5 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
        <div className="h-[200px] rounded-xl bg-slate-100 dark:bg-white/5" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-4 w-12 bg-slate-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p className="font-semibold mb-1">Fehler beim Laden</p>
          <p>{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors active:scale-95"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, dailyData, topPages, topReferrers, devices, browsers, operatingSystems, countries, hourlyData } = data;

  const peakHour = hourlyData.reduce(
    (best, h) => (h.views > best.views ? h : best),
    hourlyData[0] || { hour: "0", views: 0 }
  );

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={`rounded-xl px-3 py-2 text-xs shadow-lg border ${isDarkMode ? "bg-[#282828] text-white border-white/10" : "bg-white text-slate-900 border-slate-200"}`}>
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className={isDarkMode ? "text-gray-300" : "text-slate-600"}>
            {entry.dataKey === "views" ? "Aufrufe" : "Besucher"}: <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={`rounded-xl px-3 py-2 text-xs shadow-lg border ${isDarkMode ? "bg-[#282828] text-white border-white/10" : "bg-white text-slate-900 border-slate-200"}`}>
        <p className="font-semibold">{label}:00 Uhr</p>
        <p className={isDarkMode ? "text-gray-300" : "text-slate-600"}>
          Aufrufe: <span className="font-semibold">{payload[0].value}</span>
        </p>
      </div>
    );
  };

  // Reusable progress bar row
  const ProgressRow = ({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700 dark:text-gray-300 truncate">{label}</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="p-5 space-y-8 overflow-y-auto">

      {/* Time Range */}
      <div className="flex items-center gap-2">
        {([7, 14, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setTimeRange(d)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              timeRange === d
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/20"
            }`}
          >
            {d}T
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNumber(summary.totalPageViews)}
          </div>
          <div className="text-sm text-slate-500 dark:text-gray-400">Seitenaufrufe</div>
        </div>
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNumber(summary.uniqueSessions)}
          </div>
          <div className="text-sm text-slate-500 dark:text-gray-400">Besucher</div>
        </div>
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNumber(summary.uniqueUsers)}
          </div>
          <div className="text-sm text-slate-500 dark:text-gray-400">Eingeloggte User</div>
        </div>
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatDuration(summary.avgDuration)}
          </div>
          <div className="text-sm text-slate-500 dark:text-gray-400">Verweildauer</div>
        </div>
      </div>

      {/* Bounce + Peak inline */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-gray-400">Absprungrate</span>
          <span className="font-semibold text-slate-900 dark:text-white">{summary.bounceRate}%</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-gray-400">Peak</span>
          <span className="font-semibold text-slate-900 dark:text-white">{peakHour.hour}:00 Uhr</span>
        </div>
      </div>

      {/* Traffic Chart */}
      <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Aufrufe & Besucher</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Aufrufe
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Besucher
            </span>
          </div>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: isDarkMode ? "#6b7280" : "#94a3b8" }}
                tickFormatter={(d) => {
                  const date = new Date(d);
                  return `${date.getDate()}.${date.getMonth() + 1}.`;
                }}
                interval={Math.max(0, Math.floor(dailyData.length / 6))}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDarkMode ? "#6b7280" : "#94a3b8" }}
                width={30}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="views" name="views" stroke="#10b981" fill="url(#viewsGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="visitors" name="visitors" stroke="#3b82f6" fill="url(#visitorsGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Activity */}
      <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Aktivität nach Uhrzeit</h3>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: isDarkMode ? "#6b7280" : "#94a3b8" }}
                interval={2}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: isDarkMode ? "#6b7280" : "#94a3b8" }}
                width={25}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="views" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Pages */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Seiten</h3>
        <div className="space-y-3">
          {topPages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-gray-400">Noch keine Daten</p>
            </div>
          ) : (
            topPages.map((page, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/10 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center h-10 w-10 text-emerald-600 dark:text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">{page.path}</div>
                    <div className="text-sm text-slate-500 dark:text-gray-400">{formatDuration(page.avgDuration)} Verweildauer</div>
                  </div>
                </div>
                <div className="font-bold text-lg text-slate-900 dark:text-white pl-3">{page.views}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Referrers */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Herkunft</h3>
        {topReferrers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-gray-400">Keine Referrer-Daten</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Direktaufrufe haben keinen Referrer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topReferrers.map((ref, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/10 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center h-10 w-10 text-blue-600 dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white truncate min-w-0">{ref.source}</div>
                </div>
                <div className="font-bold text-lg text-slate-900 dark:text-white pl-3">{ref.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geräte */}
      <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Geräte</h3>
        <div className="space-y-3">
          {devices.map((device, i) => (
            <ProgressRow
              key={i}
              label={deviceLabels[device.type] || device.type}
              value={`${device.percentage}%`}
              pct={device.percentage}
              color="bg-emerald-500"
            />
          ))}
        </div>
      </div>

      {/* Browser & OS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Browser</h4>
          <div className="space-y-3">
            {browsers.map((b, i) => (
              <ProgressRow
                key={i}
                label={b.name}
                value={`${b.percentage}%`}
                pct={b.percentage}
                color="bg-emerald-500"
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Betriebssysteme</h4>
          <div className="space-y-3">
            {operatingSystems.map((os, i) => (
              <ProgressRow
                key={i}
                label={os.name}
                value={`${os.percentage}%`}
                pct={os.percentage}
                color="bg-emerald-500"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Länder */}
      {countries.length > 0 && !(countries.length === 1 && countries[0].name === "Unbekannt") && (
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Länder</h3>
          <div className="space-y-3">
            {countries.map((c, i) => (
              <ProgressRow
                key={i}
                label={c.name}
                value={`${c.count} (${c.percentage}%)`}
                pct={c.percentage}
                color="bg-emerald-500"
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-gray-500 pb-2">
        Letzte {timeRange} Tage &middot; Keine Drittanbieter
      </div>
    </div>
  );
}
