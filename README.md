# rollup-plugin-oxc

A Rollup plugin to transform, minify TypeScript and generate type declarations with oxc.

Usage:

```ts
import oxc from "rollup-plugin-oxc";

export default {
  input: "src/index.ts",
  plugins: [
    oxc({
      declaration: true,
      declarationMap: true,
    }),
  ],
  output: [
    {
      dir: ".",
      format: "esm",
      sourcemap: true,
      preserveModules: true,
    },
  ],
};
```
