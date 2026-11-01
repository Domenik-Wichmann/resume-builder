import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "public/demos/sonaway/assets/**", // Imported standalone demo code; tested separately.
    "local-career-ingest/**",
    "tmp/**",
    ".next/**",
    "next-env.d.ts",
  ]),
]);
