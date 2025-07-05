import oxc from "./src/index.ts";
import { rollup } from "rollup";

import pkg from "./package.json" with { type: "json" };

const bundle = await rollup({
  input: "src/index.ts",
  external: ["node:path", ...Object.keys(pkg.dependencies).map((dep) => new RegExp(`^${dep}`))],
  plugins: [
    oxc({
      declaration: true,
      declarationMap: true,
    }),
  ],
});

await bundle.write({
  dir: "module",
  format: "esm",
  sourcemap: true,
  preserveModules:true,
});

await bundle.write({
  dir: "node",
  format: "cjs",
  sourcemap: true,
  preserveModules:true,
});
