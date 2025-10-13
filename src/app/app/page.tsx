import { Suspense } from "react";
import MapView from "@/components/MapView";

// Force dynamic rendering for this page since it uses search params
export const dynamic = 'force-dynamic';

export default function AppPage() {
  return (
    <main className="min-h-[calc(100vh-0px)]">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
            <span className="text-lg font-medium">Lädt Karte...</span>
          </div>
        </div>
      }>
        <MapView />
      </Suspense>
    </main>
  );
}


