export default function WalletLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#282828]">
      <div className="px-5 pt-20 pb-6 space-y-8 animate-pulse">
        <div className="text-center space-y-2">
          <div className="h-9 w-24 bg-slate-200 dark:bg-white/10 rounded-lg mx-auto" />
          <div className="h-4 w-40 bg-slate-100 dark:bg-white/5 rounded mx-auto" />
        </div>
        <div className="text-center space-y-3">
          <div className="h-12 w-32 bg-slate-200 dark:bg-white/10 rounded-xl mx-auto" />
          <div className="h-11 w-40 bg-slate-200 dark:bg-white/10 rounded-xl mx-auto" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-5 w-14 bg-slate-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
