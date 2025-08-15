import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";
import { dirname, resolve } from "node:path";
import type { CompilerOptions } from "./migrate.ts";

const isEqualFoldCommonJS = (m?: string) => {
  return m?.toLowerCase() === "commonjs";
};

const getConditions = (m: string): string[] => {
  return isEqualFoldCommonJS(m) ? ["require"] : ["import", "module"];
};

const getMainFields = (m: string): string[] => {
  return isEqualFoldCommonJS(m) ? ["main"] : ["module", "main"];
};

const jsExtensions = [".js", ".jsx", ".mjs", ".cjs"];
const tsExtensions = [".ts", ".tsx", ".mts", ".cts"];

export class Resolver {
  options: NapiResolveOptions = {};
  disabled = false;
  factory: ResolverFactory;

  constructor(ro: false | NapiResolveOptions, co: CompilerOptions = {}) {
    if (ro === false) {
      this.disabled = true;
      return;
    }
    this.options = {
      extensions: [...tsExtensions, ...jsExtensions, ".json", ".wasm", ".node"],
      extensionAlias: {
        ".js": [".ts", ".tsx", ".js", ".jsx"],
        ".cjs": [".cts", ".cjs"],
        ".mjs": [".mts", ".mjs"],
        ".jsx": [".tsx", ".jsx"],
      },
      conditionNames: getConditions(co.module),
      mainFields: getMainFields(co.module),
      alias: co.paths,
      ...ro,
    };
    this.factory = new ResolverFactory(this.options);
  }

  async resolve(id: string, req: string): Promise<string | null> {
    if (this.disabled) {
      return null;
    }
    const dir = resolve(dirname(req));
    const resolved = await this.factory.async(dir, id);
    return resolved.path ?? null;
  }
}
