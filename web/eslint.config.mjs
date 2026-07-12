import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Beta react-compiler lint rules — too strict for one-shot localStorage
      // initialization and request-scoped Date.now() in server components.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      // We use `any` deliberately at a few backend-typed seams (Supabase row
      // shapes, generic IPC payloads). Tighten back when the schema is
      // fully typed via `supabase gen types`.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
