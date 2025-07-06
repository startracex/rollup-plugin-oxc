# rollup-plugin-oxc

A Rollup plugin to transform, minify TypeScript and generate type declarations with oxc.

Usage:

```ts
import oxc from "rollup-plugin-oxc";

export default {
  input: "src/index.ts",
  plugins: [
    oxc({
      tsconfigCompilerOptions: {
        target: "es2021", // oxc's target
        experimentalDecorators: true, // require `@oxc-project/runtime`
        useDefineForClassFields: false, // contrary to oxc's assumptions.setPublicClassFields, typescript.removeClassFieldsWithoutInitializer
        declaration: true, // for d.ts
        declarationMap: true, // for d.ts.map
      },
      minify: true, // preset `oxc-minify` option, pass an object for more options
      resolve: {
        // `oxc-resolver` options
      },
      transform: {
        // `oxc-transform` options, overrides tsconfigCompilerOptions migration
      },
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

Similar within Rolldown:

```ts
import migrate from "tsconfig-migrate/oxc.js";

export default {
  input: "src/index.ts",
  output: [
    {
      dir: ".",
      format: "esm",
      sourcemap: true,
      preserveModules: true,
      minify: true,
    },
  ],
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"],
  },
  transform: {
    ...migrate({
      target: "es2021",
      experimentalDecorators: true,
      useDefineForClassFields: false,
    }),
  },
};
```
