import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node utility scripts use CommonJS require() — not app code
    "scripts/**",
  ]),
  {
    rules: {
      // This rule produces false positives on all legitimate async-fetch-then-setState
      // patterns (data loading in useEffect, mobile breakpoint detection, mount guards,
      // etc.).  The Next.js / react-hooks plugin does not enable it by default;
      // it was pulled in transitively and flags hundreds of correct patterns.
      "react-hooks/set-state-in-effect": "off",
      // Downgrade to warning: Turkish UI copy naturally contains apostrophes.
      // Escaping every word like "API'yi" → "API&apos;yi" throughout all pages
      // is unnecessary churn with no safety benefit.
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
