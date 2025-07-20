# rollup-plugin-oxc

A Rollup plugin to resolve, transform, minify TypeScript and generate type declarations with oxc.

## Usage

```js
import oxc from "rollup-plugin-oxc";

export default {
  input: "src/index.ts",
  plugins: [
    oxc({
      minify: true, // preset `oxc-minify` option, pass an object for more options
      resolve: {
        // `oxc-resolver` options
      },
      transform: {
        // `oxc-transform` options, overrides tsconfigCompilerOptions migration
      },
      tsconfigCompilerOptions: {
        target: "es2021", // oxc's target
        experimentalDecorators: true, // require `@oxc-project/runtime`
        useDefineForClassFields: false, // contrary to oxc's assumptions.setPublicClassFields, typescript.removeClassFieldsWithoutInitializer
        declaration: true, // for d.ts
        declarationMap: true, // for d.ts.map
      },
    }),
  ],
  output: [
    {
      dir: ".",
      format: "esm",
      sourcemap: true,
    },
  ],
};
```

## Interchangeable

These Rollup plugins can be replaced.

- Module resolvers e.g., `@rollup/plugin-node-resolve`
- Transformers e.g., `@rollup/plugin-typescript`
- Compressors e.g., `@rollup/plugin-terser`

```js
import nodeResolve from "@rollup/plugin-typescript";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default {
  plugins: [nodeResolve(), typescript(), terser()],
};
```

```js
import oxc from "rollup-plugin-oxc";

export default {
  plugins: [oxc()],
};
```

In Rolldown, this plugin can be removed.

```js
import migrate from "rollup-plugin-oxc/migrate.js";

export default {
  input: "src/index.ts",
  output: [
    {
      dir: ".",
      format: "esm",
      sourcemap: true,
      minify: true,
    },
  ],
  resolve: {
    /* resolve options */
  },
  transform: {
    ...{
      /* transform options */
    },
    ...migrate({
      target: "es2021",
      experimentalDecorators: true,
      useDefineForClassFields: false,
    }),
  },
};
```
