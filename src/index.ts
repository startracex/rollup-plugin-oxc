import { isolatedDeclaration, transform, type SourceMap, type TransformOptions } from "oxc-transform";
import { type NapiResolveOptions } from "oxc-resolver";
import { dirname, extname, relative, resolve as pathResolve, basename, join } from "node:path";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import type { EmitFile, Plugin, RollupFsModule } from "rollup";
import { minify, type MinifyOptions } from "oxc-minify";
import migrate, { type CompilerOptions } from "./migrate.ts";
import { readFile as fsReadFile } from "node:fs/promises";
import { Resolver } from "./resolver.ts";

const defaultMinifyOptions: MinifyOptions = {
  sourcemap: true,
  compress: {
    keepNames: {
      function: false,
      class: true,
    },
  },
};

const emitDts = ({ code, map, fileName, emitFile }: { code: string; map: SourceMap; fileName: string; emitFile: EmitFile }): void => {
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

const getDtsExt = (ext: string, strict: boolean = true): string | undefined => {
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return strict ? `.d${ext}` : ".d.ts";
    case ".tsx":
      return ".d.ts";
  }
};

export type Options = Partial<{
  /**
   * tsconfog compiler options
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
   * If falsely, disable minify.
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
  // @internal
  _shouldResolve: (id: string, importer: string) => boolean;
}>;

export default function oxc({
  include,
  exclude,
  resolve: resolveOptions = {},
  tsconfigCompilerOptions = {},
  transform: transformOptions = {},
  minify: minifyOptions,
  _fs: fs = {},
  _shouldResolve = () => true,
}: Options = {}): Plugin {
  const filter = createFilter(include, exclude);
  const migratedOptions = migrate(tsconfigCompilerOptions);
  const rr = new Resolver(resolveOptions, tsconfigCompilerOptions);
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
      ...transformOptions,
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
      if (_shouldResolve(id, importer)) {
        const dir = importer ? pathResolve(dirname(importer)) : process.cwd();
        return rr.resolve(id, dir);
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
      if (!dir || !declarationOptions) {
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
        const declarationPath = `${fileName.slice(0, -extname(fileName).length)}${dtsExt}`;

        const assertPath = join(dir, declarationPath);
        if (declarationCache.has(assertPath)) {
          continue;
        }

        declarationCache.add(assertPath);
        const rel = relative(pathResolve(dir, fileName), chunk.facadeModuleId).replaceAll("\\", "/");
        const readFile =
          fs.readFile ??
          this.fs?.readFile ??
          // in rolldown, `this.fs` is undefined currently, so fallback to `node:fs.readFile`
          fsReadFile;
        const srcBuf = await readFile(chunk.facadeModuleId);

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
