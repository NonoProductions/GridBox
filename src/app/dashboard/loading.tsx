export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#282828]">
      <div className="px-5 pt-20 pb-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-white/10 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-slate-100 dark:bg-white/5" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
