import { Suspense } from "react";
import MapViewMapbox from "@/components/MapViewMapbox";

// Force dynamic rendering for this page since it uses search params
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="fixed inset-0 w-full h-full">
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
            <span className="text-lg font-medium">Lädt Karte...</span>
          </div>
        </div>
      }>
        <MapViewMapbox />
      </Suspense>
    </main>
  );
}
