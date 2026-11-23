import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Client components take shared types from lib/consultations/types. The
    // service and the admin client pull in 'server-only', so a value import of
    // either would break the client build.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/consultations/service", message: "Import types from @/lib/consultations/types." },
            { name: "@/lib/supabase/admin", message: "Server only." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
