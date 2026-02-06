import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-config-next liefert ab v16 eine native Flat-Config.
// Direkt laden vermeidet den "Converting circular structure to JSON"-Fehler von FlatCompat.
const nextConfig = require("eslint-config-next/core-web-vitals");

export default [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];
