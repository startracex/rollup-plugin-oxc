import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";
import { dirname, extname, resolve } from "node:path";
import type { CompilerOptions } from "./migrate.ts";

const isTsExt = (ext: string): boolean => {
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".mts":
    case ".cts":
      return true;
  }
  return false;
};

const getConditions = (m: string): string[] => {
  if (m === "commonjs") {
    return ["require", "node"];
  }
  return ["import", "module"];
};

const getMainFields = (m: string): string[] => {
  return m === "commonjs" ? ["main"] : ["module", "main"];
};

const nodeExtension = ".node";
const jsExtensions = [".js", ".json", ".mjs", ".cjs"];
const tsExtensions = [".ts", ".js", ".json", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];

export class Resolver {
  options: NapiResolveOptions = {};
  disabled = false;
  factory: ResolverFactory;
  exts: Set<string>;

  /**
   * Only for import requests from ts, consider the ts extensions.
   */
  tsFactory: ResolverFactory;
  tsExts: Set<string>;
  constructor(ro: false | NapiResolveOptions, co: CompilerOptions = {}) {
    if (ro === false) {
      this.disabled = true;
      return;
    }
    this.options = {
      extensions: [...jsExtensions, nodeExtension],
      conditionNames: getConditions(co.module),
      mainFields: getMainFields(co.module),
      alias: co.paths,
      ...ro,
    };
    this.init();
  }

  init(): void {
    this.exts = new Set(this.options.extensions);
    this.tsExts = new Set([...tsExtensions, ...(this.options.extensions ?? [...jsExtensions, nodeExtension])]);
    this.factory = new ResolverFactory(this.options);
    this.tsFactory = new ResolverFactory({
      ...this.options,
      extensions: [...this.tsExts],
    });
  }

  resolve(id: string, req: string): string | null {
    if (this.disabled) {
      return null;
    }
    const dir = resolve(dirname(req));
    const ext = extname(id);
    const reqExt = extname(req);
    const { factory, exts } = isTsExt(reqExt)
      ? {
          factory: this.tsFactory,
          exts: this.tsExts,
        }
      : {
          factory: this.factory,
          exts: this.exts,
        };
    let resolved = factory.sync(dir, id);
    if (!resolved.path && exts.has(ext)) {
      id = id.slice(0, -ext.length);
      resolved = factory.sync(dir, id);
    }
    return resolved.path ?? null;
  }
}
