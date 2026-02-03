/**
 * Macht eine Stations-Foto-URL immer absolut, damit Fotos auch in Production
 * (z.B. Vercel) funktionieren – nicht nur lokal.
 * Supabase Storage liefert teils relative Pfade; diese werden mit der
 * Projekt-URL zu einer absoluten URL ergänzt.
 */
export function getAbsoluteStationPhotoUrl(
  url: string | undefined | null
): string {
  if (!url || typeof url !== "string" || url.trim() === "") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base) return trimmed;
  const baseClean = base.replace(/\/$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseClean}${path}`;
}
