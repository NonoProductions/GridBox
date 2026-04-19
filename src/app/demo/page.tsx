"use client";

export const dynamic = "force-dynamic";

/**
 * iPhone 17 reference dimensions (mm):
 *   body:    71.5 × 149.6   (aspect 0.4779)
 *   display: 6.3" OLED, 2622×1206 px (~874 × 402 pt)
 *   bezel:   ~2 mm uniform on all sides
 *
 * Using CSS, horizontal %-values resolve against element width and
 * vertical %-values resolve against element height. We therefore use
 * different % values for top/bottom vs left/right to get a visually
 * uniform bezel, and split border-radius as "H% / V%" for symmetric
 * (circular) corners rather than elliptical ones.
 *
 *   body width-radius  ≈ 13.0% of width  → 9.3 mm
 *   body height-radius ≈ 6.22% of height → 9.3 mm  (same physical radius)
 *
 *   bezel horizontal   ≈ 2.9% of width   → 2.07 mm
 *   bezel vertical     ≈ 1.4% of height  → 2.09 mm
 *
 *   display width-radius  ≈ 10.8% of display width
 *   display height-radius ≈ 5.02% of display height
 */

export default function DemoPage() {
  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-[radial-gradient(ellipse_at_top,#0f2420_0%,#05100e_42%,#020706_100%)]">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-48 -right-48 h-[520px] w-[520px] rounded-full bg-emerald-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-56 -left-48 h-[520px] w-[520px] rounded-full bg-emerald-400/10 blur-[140px]" />

      {/* Top branding */}
      <div className="relative z-10 shrink-0 pt-5 pb-2 text-center select-none">
        <div className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-emerald-300/70 font-semibold">
          GridBox · Live Demo
        </div>
        <div className="mt-0.5 text-lg md:text-xl font-semibold text-white/95">
          Mobile Experience
        </div>
      </div>

      {/* Phone stage */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4">
        <div
          className="relative"
          style={{
            height:
              "min(calc(100svh - 130px), calc((100svw - 48px) * 149.6 / 71.5))",
            aspectRatio: "71.5 / 149.6",
          }}
        >
          {/* ---------------- Titanium body ---------------- */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: "13% / 6.22%",
              background:
                "linear-gradient(145deg, #48484c 0%, #2a2a2c 18%, #161618 42%, #0f0f10 58%, #1f1f21 82%, #3a3a3d 100%)",
              boxShadow:
                "0 35px 90px -25px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Specular edge highlight */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: "13% / 6.22%",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.6)",
              }}
            />
          </div>

          {/* Side buttons — iPhone 17 layout */}
          {/* Action Button (left, top) */}
          <div className="absolute -left-[0.7%] top-[17%] h-[4%] w-[0.8%] rounded-l-[2px] bg-zinc-800" />
          {/* Volume Up */}
          <div className="absolute -left-[0.8%] top-[24%] h-[7%] w-[0.9%] rounded-l-[3px] bg-zinc-800" />
          {/* Volume Down */}
          <div className="absolute -left-[0.8%] top-[33%] h-[7%] w-[0.9%] rounded-l-[3px] bg-zinc-800" />
          {/* Side (Power) button */}
          <div className="absolute -right-[0.8%] top-[22%] h-[10%] w-[0.9%] rounded-r-[3px] bg-zinc-800" />
          {/* Camera Control */}
          <div className="absolute -right-[0.5%] top-[37%] h-[5%] w-[0.7%] rounded-r-[2px] bg-zinc-700" />

          {/* ---------------- Display (uniform ~2mm bezel) ---------------- */}
          <div
            className="absolute overflow-hidden bg-black"
            style={{
              top: "1.4%",
              bottom: "1.4%",
              left: "2.9%",
              right: "2.9%",
              borderRadius: "10.8% / 5.02%",
            }}
          >
            {/* iOS status bar (time + indicators) — aligned with Dynamic Island vertically */}
            <div
              className="absolute inset-x-0 z-30 flex items-center justify-between px-[8%] text-white pointer-events-none"
              style={{ top: "1.3%", height: "4.2%" }}
            >
              <span
                className="font-semibold tracking-tight"
                style={{ fontSize: "clamp(9px, 1.9cqw, 16px)" }}
              >
                9:41
              </span>
              <div className="flex items-center gap-[4%]">
                {/* signal bars */}
                <svg
                  viewBox="0 0 18 12"
                  fill="white"
                  style={{ height: "45%", width: "auto" }}
                >
                  <rect x="0" y="8" width="3" height="4" rx="0.5" />
                  <rect x="5" y="5" width="3" height="7" rx="0.5" />
                  <rect x="10" y="2" width="3" height="10" rx="0.5" />
                  <rect x="15" y="0" width="3" height="12" rx="0.5" />
                </svg>
                {/* wifi */}
                <svg
                  viewBox="0 0 16 12"
                  fill="white"
                  style={{ height: "45%", width: "auto" }}
                >
                  <path d="M8 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                  <path d="M3 6.5 a7 7 0 0 1 10 0 l-1.2 1.2 a5.3 5.3 0 0 0 -7.6 0 z" />
                  <path d="M0 3 a11 11 0 0 1 16 0 l-1.2 1.2 a9.3 9.3 0 0 0 -13.6 0 z" />
                </svg>
                {/* battery */}
                <div
                  className="relative flex items-center"
                  style={{ height: "45%" }}
                >
                  <div
                    className="relative rounded-[2px] border border-white/90"
                    style={{ height: "100%", width: "22px" }}
                  >
                    <div
                      className="absolute inset-[1px] rounded-[1px] bg-white"
                      style={{ width: "calc(100% - 2px)" }}
                    />
                  </div>
                  <div
                    className="ml-[1px] rounded-r-[1px] bg-white/90"
                    style={{ width: "1.5px", height: "40%" }}
                  />
                </div>
              </div>
            </div>

            {/*
              iframe wrapper
              We render the iframe at 1.5x logical resolution and scale it down
              so more app content fits in the same visible phone viewport.

              iPhone 17 logical display: 402 × 874 pt
              Top safe area (Dynamic Island): 59 pt  ≈ 6.75% of display
              Bottom safe area (Home indicator): 34 pt ≈ 3.89% of display
              Viewport between safe areas: 402 × 781 pt (aspect 0.515)
            */}
            <div
              className="absolute overflow-hidden"
              style={{
                top: "6.75%",
                bottom: "0%",
                left: 0,
                right: 0,
              }}
            >
              <iframe
                src="/"
                title="GridBox Mobile Demo"
                className="absolute top-0 left-0 border-0"
                style={{
                  width: "390px",
                  height: "780px",
                  transform: "scale(0.78)",
                  transformOrigin: "top left",
                }}
                allow="geolocation; camera; clipboard-read; clipboard-write"
              />
            </div>

            {/* Home indicator bar (bottom safe area) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-30 rounded-full bg-white/90 pointer-events-none"
              style={{
                bottom: "1.2%",
                width: "35%",
                height: "0.55%",
              }}
            />

            {/* Dynamic Island — solid black pill, centered */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-40 rounded-full bg-black"
              style={{
                top: "1.3%",
                width: "31%",
                aspectRatio: "126 / 37",
                boxShadow:
                  "inset 0 0 0 1px #0a0a0a, 0 1px 3px rgba(0,0,0,0.8)",
              }}
            />
          </div>

          {/* Outer glass reflection (very subtle) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              borderRadius: "13% / 6.22%",
              background:
                "linear-gradient(150deg, rgba(255,255,255,0.8) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.4) 100%)",
            }}
          />
        </div>
      </div>

      {/* Bottom caption */}
      <div className="relative z-10 shrink-0 pb-3 pt-1 text-center select-none">
        <div className="text-[11px] text-white/40 tracking-wide">
          iPhone 17 · Powerbank ausleihen, jederzeit &amp; überall
        </div>
      </div>
    </div>
  );
}
