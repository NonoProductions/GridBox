export default function ReservierungLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#282828]">
      <div className="px-5 pt-20 pb-6 space-y-8 animate-pulse">
        <div className="text-center space-y-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-white/10 rounded-lg mx-auto" />
          <div className="h-4 w-36 bg-slate-100 dark:bg-white/5 rounded mx-auto" />
        </div>
        <div className="h-32 rounded-2xl bg-slate-100 dark:bg-white/5" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
