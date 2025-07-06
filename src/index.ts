import { isolatedDeclaration, transform, type TransformOptions } from "oxc-transform";
import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";
import { dirname, extname, relative, resolve as pathResolve, basename } from "node:path";
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

const emitDts = ({ code, map, fileName, emitFile }) => {
  emitFile({
    type: "asset",
    fileName,
    source: code,
  });
  if (map) {
    map.file = basename(fileName);
    emitFile({
      type: "asset",
      fileName: `${fileName}.map`,
      source: JSON.stringify(map),
    });
  }
};

const isTsExt = (ext: string) => {
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".mts":
    case ".cts":
      return true;
    default:
      return false;
  }
};

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
  minify: minifyOptions,
}: Options = {}): Plugin {
  const filter = createFilter(include, exclude);
  let rf: ResolverFactory;
  if (resolveOptions !== false) {
    resolveOptions.extensions ??= [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];
    rf = new ResolverFactory(resolveOptions);
  }

  const migratedOptions = migrate(tsconfigCompilerOptions);
  const declarationCache = new Set<string>();
  const declarationOptions =
    migratedOptions.typescript.declaration ?? (transformOptions ? transformOptions.typescript?.declaration : undefined);
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
  if (minifyOptions === true) {
    minifyOptions = defaultMinifyOptions;
  }
  return {
    name: "oxc",
    resolveId(id: string, importer?: string) {
      if (!resolveOptions) {
        return null;
      }
      if (id.startsWith("./") || id.startsWith("../")) {
        const dir = importer ? pathResolve(dirname(importer)) : process.cwd();
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
        if (chunk.type !== "chunk" || !chunk.facadeModuleId) {
          continue;
        }

        const srcExt = extname(chunk.facadeModuleId);
        if (!isTsExt(srcExt)) {
          continue;
        }

        const dtsExt = `.d${srcExt === ".tsx" ? ".ts" : srcExt}`;
        const declarationPath = `${fileName.slice(0, -extname(fileName).length)}${dtsExt}`;

        if (declarationCache.has(declarationPath)) {
          continue;
        }

        declarationCache.add(declarationPath);
        const rel = relative(pathResolve(dir, fileName), chunk.facadeModuleId).replaceAll("\\", "/");
        const srcBuf = await this.fs.readFile(chunk.facadeModuleId);

        const { code, map, errors } = isolatedDeclaration(rel, srcBuf.toString(), declarationOptions);
        for (const err of errors) {
          this.warn(err);
        }

        emitDts({ code, map, fileName: declarationPath, emitFile: this.emitFile });
      }
    },
    renderChunk(code, chunk) {
      if (!minifyOptions) {
        return null;
      }
      return minify(chunk.fileName, code, minifyOptions);
    },
  };
}
