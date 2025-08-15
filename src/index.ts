import { transform, type IsolatedDeclarationsOptions, type TransformOptions } from "oxc-transform";
import { type NapiResolveOptions } from "oxc-resolver";
import { extname, relative, resolve as pathResolve, join } from "node:path";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import type { Plugin, RollupFsModule } from "rollup";
import { minify, type MinifyOptions } from "oxc-minify";
import migrate, { type CompilerOptions } from "./migrate.ts";
import { readFile as fsReadFile } from "node:fs/promises";
import { Resolver } from "./resolver.ts";
import { DTS, fixExt, getDtsExt, emitDts } from "./dts.ts";
import { parse } from "tsconfck";

const defaultMinifyOptions: MinifyOptions = {
  sourcemap: true,
  compress: {
    keepNames: {
      function: false,
      class: true,
    },
  },
};

export type Options = Partial<{
  /**
   * tsconfig path or options.
   */
  tsconfig:
    | string
    | {
        compilerOptions: CompilerOptions;
      };
  /**
   * Promotion of oxc transform's typescript.declaration options.
   *
   * If `false`, disable declaration.
   */
  declaration: boolean | IsolatedDeclarationsOptions;
  /**
   * tsconfog compiler options.
   * @deprecated use `tsconfig.compilerOptions` instead.
   */
  tsconfigCompilerOptions: CompilerOptions;
  /**
   * oxc-transform options.
   *
   * If `false`, disable transform.
   */
  transform: false | TransformOptions;
  /**
   * oxc-resolve options.
   *
   * If `false`, disable module resolve.
   */
  resolve: false | NapiResolveOptions;
  /**
   * oxc-minify options.
   *
   * If `true`, use default options.
   * If `false`, disable minify.
   */
  minify: boolean | MinifyOptions;
  /**
   * Include pattern.
   */
  include: FilterPattern;
  /**
   * Exclude pattern.
   */
  exclude: FilterPattern;
  // @internal
  _fs: Partial<RollupFsModule>;
}>;

export default async function oxc({
  tsconfig = "tsconfig.json",
  include,
  exclude,
  declaration: declarationOptions,
  resolve: resolveOptions = {},
  tsconfigCompilerOptions,
  transform: transformOptions = {},
  minify: minifyOptions,
  _fs: fs = {},
}: Options = {}): Promise<Plugin> {
  const filter = createFilter(include, exclude);
  if (!tsconfigCompilerOptions) {
    if (typeof tsconfig === "string") {
      try {
        tsconfig = (await parse(tsconfig)).tsconfig as { compilerOptions: CompilerOptions };
      } catch {
        tsconfig = {
          compilerOptions: {},
        };
      }
    }
    tsconfigCompilerOptions = tsconfig.compilerOptions;
  }
  const migratedOptions = migrate(tsconfigCompilerOptions ?? {});
  const rr = new Resolver(resolveOptions, tsconfigCompilerOptions);
  if (transformOptions !== false) {
    transformOptions = {
      ...migratedOptions,
      sourcemap: migratedOptions.sourcemap ?? true,
      typescript: {
        ...migratedOptions.typescript,
        declaration: undefined,
      },
      ...transformOptions,
    };
  }
  if (minifyOptions === true) {
    minifyOptions = defaultMinifyOptions;
  }
  const dtsFactory = new DTS(declarationOptions ?? (transformOptions || {}).typescript?.declaration, tsconfigCompilerOptions);
  return {
    name: "oxc",
    resolveId(id: string, importer?: string) {
      if (!importer || id.startsWith("\0")) {
        return null;
      }
      return rr.resolve(id, importer);
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
    async generateBundle({ dir, sourcemap, sourcemapExcludeSources, sourcemapBaseUrl }, bundle) {
      if (!dir || dtsFactory.disabled) {
        return;
      }
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk" || !chunk.facadeModuleId) {
          continue;
        }

        const dtsExt = getDtsExt(extname(chunk.facadeModuleId));
        if (!dtsExt) {
          continue;
        }
        const declarationPath = fixExt(fileName, dtsExt);

        const assertPath = join(dir, declarationPath);
        if (dtsFactory.cache.has(assertPath)) {
          continue;
        }

        dtsFactory.cache.add(assertPath);
        const relativePath = relative(pathResolve(dir, fileName), chunk.facadeModuleId).replaceAll("\\", "/");
        const readFile =
          fs.readFile ??
          this.fs?.readFile ??
          // in rolldown, `this.fs` is undefined currently, so fallback to `node:fs.readFile`
          fsReadFile;
        const srcBuf = await readFile(chunk.facadeModuleId);

        const { code, map, errors } = dtsFactory.getDeclaration(relativePath, srcBuf.toString(), {
          sourceMap: typeof sourcemap === "boolean" ? sourcemap : undefined,
          sourceRoot: sourcemapBaseUrl,
          inlineSources: !sourcemapExcludeSources,
        });

        emitDts({ code, map, fileName: declarationPath, emitFile: this.emitFile });

        for (const err of errors) {
          this.warn(err);
        }
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
