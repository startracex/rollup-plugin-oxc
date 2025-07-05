import { isolatedDeclaration, transform, type TransformOptions } from "oxc-transform";
import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";
import { dirname, extname, relative, resolve as pathResolve } from "node:path";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import type { Plugin } from "rollup";
import { minify, type MinifyOptions } from "oxc-minify";
import migrate, { type CompilerOptions } from "./migrate.ts";

const defaultMinifyOptions = {
  sourcemap: true,
  compress: {
    keepNames: {
      function: false,
      class: true,
    },
  },
} as MinifyOptions;

export type Options = Partial<{
  tsconfigCompilerOptions: CompilerOptions;
  transform: false | TransformOptions;
  resolve: false | NapiResolveOptions;
  minify: boolean | MinifyOptions;
  include: FilterPattern;
  exclude: FilterPattern;
}>;

export default function oxc({
  include,
  exclude,
  resolve: resolveOptions = {},
  tsconfigCompilerOptions = {},
  transform: transformOptions = {},
  ...options
}: Options = {}): Plugin {
  const filter = createFilter(include, exclude);
  let rf: ResolverFactory;
  if (resolveOptions !== false) {
    resolveOptions.extensions ??= [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];
    rf = new ResolverFactory(resolveOptions);
  }

  const migratedOptions = migrate(Object.assign(tsconfigCompilerOptions, options));
  if (transformOptions !== false) {
    transformOptions = {
      ...migratedOptions,
      sourcemap: migratedOptions.sourcemap ?? true,
      typescript: {
        ...migratedOptions.typescript,
        declaration: undefined,
      },
      ...transform,
    };
  }
  const declarationOptions = migratedOptions.typescript.declaration;

  return {
    name: "oxc",
    resolveId(id: string, importer: string) {
      if (!resolveOptions) {
        return null;
      }
      if (id.startsWith("./") || id.startsWith("../")) {
        const dir = pathResolve(dirname(importer));
        const ext = extname(id);
        if (resolveOptions.extensions.includes(ext)) {
          id = id.slice(0, -ext.length);
        }
        const resolved = rf.sync(dir, id);
        return resolved.path ?? null;
      }
      return null;
    },
    transform(src: string, id: string) {
      if (!transformOptions || !filter(id)) {
        return null;
      }
      const { code, map, errors } = transform(id, src, transformOptions);
      for (const err of errors) {
        this.warn(err);
      }
      return {
        code,
        map,
      };
    },
    async generateBundle({ dir }, bundle) {
      if (!declarationOptions) {
        return;
      }
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && chunk.facadeModuleId) {
          const rel = relative(pathResolve(dir, fileName), chunk.facadeModuleId).replaceAll("\\", "/");
          const srcBuf = await this.fs.readFile(chunk.facadeModuleId);

          const { code, map, errors } = isolatedDeclaration(rel, srcBuf.toString(), declarationOptions);
          for (const err of errors) {
            this.warn(err);
          }

          const declarationPath = fileName.slice(0, -extname(fileName).length) + ".d.ts";
          this.emitFile({
            type: "asset",
            fileName: declarationPath,
            source: code,
          });
          if (declarationOptions.sourcemap) {
            map.file = declarationPath;
            this.emitFile({
              type: "asset",
              fileName: `${declarationPath}.map`,
              source: JSON.stringify(map),
            });
          }
        }
      }
    },
    renderChunk(code, chunk) {
      if (!options.minify) {
        return null;
      }
      return minify(chunk.fileName, code, options.minify === true ? defaultMinifyOptions : options.minify);
    },
  };
}
