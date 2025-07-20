import oxc from "./src/index.ts";
import { rollup } from "rollup";

import pkg from "./package.json" with { type: "json" };

const bundle = await rollup({
  input: ["src/index.ts", "src/migrate.ts"],
  external: [/^node:/, ...Object.keys(pkg.dependencies).map((dep) => new RegExp(`^${dep}`))],
  plugins: [
    oxc(),
  ],
});

await bundle.write({
  dir: "build",
  format: "esm",
  sourcemap: true,
  preserveModules: true,
});

await bundle.write({
  dir: "build",
  format: "cjs",
  sourcemap: true,
  preserveModules: true,
  entryFileNames: "[name].cjs",
});
