import { isolatedDeclaration, transform, type TransformOptions } from "oxc-transform";
import { ResolverFactory } from "oxc-resolver";
import { dirname, extname, relative, resolve } from "node:path";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import type { Plugin } from "rollup";
import { minify } from "oxc-minify";

type MigrateOptions = Partial<{
  extensions: string[];
  rewriteImportExtensions: boolean;
  experimentalDecorators: boolean;
  emitDecoratorMetadata: boolean;
  declaration: boolean;
  declarationMap: boolean;
  target: string;
  jsx: TransformOptions["jsx"];
  minify: boolean;
  include: FilterPattern;
  exclude: FilterPattern;
}>;

export default function oxc({ include, exclude, experimentalDecorators, emitDecoratorMetadata, ...options }: MigrateOptions = {}): Plugin {
  const filter = createFilter(include, exclude);
  options.extensions ??= [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];
  const rf = new ResolverFactory({
    extensions: options.extensions,
  });
  return {
    name: "oxc",
    resolveId(id: string, importer: string) {
      if (id.startsWith("./") || id.startsWith("../")) {
        const dir = resolve(dirname(importer));
        const ext = extname(id);
        if (options.extensions.includes(ext)) {
          id = id.slice(0, -ext.length);
        }
        const resolved = rf.sync(dir, id);
        return resolved.path ?? null;
      }
      return null;
    },
    transform(src: string, id: string) {
      if (!filter(id)) {
        return null;
      }
      const emitDecorator = experimentalDecorators !== null && experimentalDecorators !== undefined;
      const { code, map } = transform(id, src, {
        target: options.target,
        sourcemap: true,
        sourceType: "module",
        assumptions: {
          setPublicClassFields: true,
        },
        jsx: options.jsx,
        decorator: emitDecorator
          ? {
              legacy: experimentalDecorators,
              emitDecoratorMetadata,
            }
          : undefined,
        typescript: {
          removeClassFieldsWithoutInitializer: true,
          rewriteImportExtensions: true,
        },
      });
      return {
        code,
        map,
      };
    },
    async generateBundle({ dir }, bundle) {
      if (!options.declaration) {
        return;
      }
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && chunk.facadeModuleId) {
          const rel = relative(resolve(dir, fileName), chunk.facadeModuleId).replaceAll("\\", "/");
          const srcBuf = await this.fs.readFile(chunk.facadeModuleId);

          const { code, map } = isolatedDeclaration(rel, srcBuf.toString(), {
            sourcemap: options.declarationMap,
          });

          const declarationPath = fileName.slice(0, -extname(fileName).length) + ".d.ts";
          this.emitFile({
            type: "asset",
            fileName: declarationPath,
            source: code,
          });
          if (options.declarationMap) {
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
      return minify(chunk.fileName, code, {
        compress: {
          target: options.target as any,
          keepNames: {
            function: false,
            class: true,
          },
        },
        sourcemap: true,
      });
    },
  };
}
