import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    NEXT_PUBLIC_MAPBOX_LIGHT_STYLE: process.env.NEXT_PUBLIC_MAPBOX_LIGHT_STYLE,
    NEXT_PUBLIC_MAPBOX_DARK_STYLE: process.env.NEXT_PUBLIC_MAPBOX_DARK_STYLE,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
