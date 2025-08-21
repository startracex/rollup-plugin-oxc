import { globSync } from "node:fs";
import type { RollupOptions } from "rollup";
import oxc from "./src/index.ts";
import pkg from "./package.json" with { type: "json" };

export default {
  input: Object.fromEntries(
    globSync("src/**/*.ts").map((path) => {
      return [path.slice(4, -3), path];
    }),
  ),
  external: [
    /^node:/,
    ...Object.keys(pkg.dependencies).map((dep) =>
      new RegExp(`^${dep}($|\/\.*)`)
    ),
  ],
  plugins: [oxc()],
  output: [
    {
      dir: "build",
      format: "esm",
      sourcemap: true,
      hoistTransitiveImports: false,
    },
    {
      dir: "build",
      format: "cjs",
      sourcemap: true,
      entryFileNames: "[name].cjs",
      hoistTransitiveImports: false,
    },
  ],
} satisfies RollupOptions;
