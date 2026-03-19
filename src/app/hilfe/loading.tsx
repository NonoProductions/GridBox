export default function HilfeLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#282828]">
      <div className="px-5 pt-20 pb-6 space-y-8 animate-pulse">
        <div className="text-center space-y-2">
          <div className="h-8 w-40 bg-slate-200 dark:bg-white/10 rounded-lg mx-auto" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-white/5 rounded mx-auto" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 rounded-xl bg-slate-100 dark:bg-white/5" />
          <div className="h-24 rounded-xl bg-slate-100 dark:bg-white/5" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
