import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";
import { extname } from "node:path";
import type { CompilerOptions } from "./migrate.ts";

const defaultExtensions = [".ts", ".js", ".json", ".tsx", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];

const getConditions = (m: string): string[] => {
  if (m === "commonjs") {
    return ["require", "node"];
  }
  return ["import", "module"];
};

const getMainFields = (m: string): string[] => {
  return m === "commonjs" ? ["main"] : ["module", "main"];
};

export class Resolver {
  options: NapiResolveOptions = {};
  disabled = false;
  factory: ResolverFactory;
  exts: Set<string>;
  constructor(ro: false | NapiResolveOptions, co: CompilerOptions = {}) {
    if (ro === false) {
      this.disabled = true;
      return;
    }
    this.options = {
      extensions: defaultExtensions,
      conditionNames: getConditions(co.module),
      mainFields: getMainFields(co.module),
      alias: co.paths,
      ...ro,
    };
    this.init();
  }

  init(): void {
    this.factory = new ResolverFactory(this.options);
    this.exts = new Set(this.options.extensions);
  }

  resolve(id: string, dir: string): string | null {
    if (this.disabled) {
      return null;
    }
    const ext = extname(id);
    let resolved = this.factory.sync(dir, id);
    if (!resolved.path && this.exts.has(ext)) {
      id = id.slice(0, -ext.length);
      resolved = this.factory.sync(dir, id);
    }
    return resolved.path ?? null;
  }
}
