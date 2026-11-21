import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // src/core is pure: no fetch, no Next/React, no other app layers.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom", "react/*"], message: "src/core must not import Next/React." },
            { group: ["@/adapters/*", "@/app/*", "@/ui/*", "**/adapters/**", "**/app/**", "**/ui/**"], message: "src/core must not import other layers." },
          ],
        },
      ],
      "no-restricted-globals": ["error", { name: "fetch", message: "src/core is pure: no network." }],
    },
  },
];

export default config;
