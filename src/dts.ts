import { isolatedDeclaration, type IsolatedDeclarationsOptions, type IsolatedDeclarationsResult, type SourceMap } from "oxc-transform";
import type { CompilerOptions } from "./migrate.ts";
import { basename, extname } from "node:path";
import type { EmitFile } from "rollup";

export const getDtsExt = (ext: string, strict: boolean = true): string | undefined => {
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return strict ? `.d${ext}` : ".d.ts";
    case ".tsx":
      return ".d.ts";
  }
};

export const fixExt = (path: string, ext: string): string => {
  return `${path.slice(0, -extname(path).length)}${ext}`;
};

export const emitDts = ({
  code,
  map,
  fileName,
  emitFile,
}: {
  code: string;
  map: SourceMap;
  fileName: string;
  emitFile: EmitFile;
}): void => {
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

export class DTS {
  options: IsolatedDeclarationsOptions = {};
  disabled = false;
  cache: Set<string> = new Set();
  sourceRoot?: string;
  inlineSources?: boolean;
  constructor(ido: boolean | IsolatedDeclarationsOptions, co: CompilerOptions = {}) {
    if (ido === false) {
      this.disabled = true;
      return;
    }
    if (ido === true) {
      ido = {};
    }
    this.sourceRoot = co.sourceRoot;
    this.inlineSources = co.inlineSources;
    this.options = {
      sourcemap: co.declarationMap,
      stripInternal: co.stripInternal,
      ...ido,
    };
  }

  getDeclaration(
    fileName: string,
    src: string,
    {
      sourceMap = this.options.sourcemap,
      sourceRoot = this.sourceRoot,
      inlineSources = this.inlineSources,
    }: {
      sourceMap?: boolean;
      sourceRoot?: string;
      inlineSources?: boolean;
    } = {}
  ): IsolatedDeclarationsResult {
    const { code, map, errors } = isolatedDeclaration(fileName, src, {
      sourcemap: sourceMap,
      stripInternal: this.options.stripInternal,
    });
    if (!inlineSources) {
      delete map.sourcesContent;
    }
    if (sourceRoot === "" || sourceRoot) {
      map.sourceRoot = sourceRoot;
    }
    return { code, map, errors };
  }
}
