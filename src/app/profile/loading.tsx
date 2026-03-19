export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#282828]">
      <div className="px-5 pt-20 pb-6 space-y-8 animate-pulse">
        <div className="text-center space-y-2">
          <div className="h-9 w-20 bg-slate-200 dark:bg-white/10 rounded-lg mx-auto" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-white/5 rounded mx-auto" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-12 bg-slate-200 dark:bg-white/10 rounded" />
            <div className="h-12 w-full bg-slate-100 dark:bg-white/5 rounded-xl" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded" />
            <div className="h-12 w-full bg-slate-100 dark:bg-white/5 rounded-xl" />
          </div>
          <div className="h-12 w-full bg-slate-200 dark:bg-white/10 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-6 w-24 bg-slate-200 dark:bg-white/10 rounded" />
          <div className="h-16 w-full bg-slate-100 dark:bg-white/5 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-6 w-16 bg-slate-200 dark:bg-white/10 rounded" />
          <div className="h-16 w-full bg-slate-100 dark:bg-white/5 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
