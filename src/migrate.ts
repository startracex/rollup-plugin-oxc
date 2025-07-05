import type { IsolatedDeclarationsOptions, TransformOptions } from "oxc-transform";

type NullableOptions<T> = { [P in keyof T]?: T[P] | null };

export type CompilerOptions = NullableOptions<{
  target: string;
  declaration: boolean;
  declarationMap: boolean;
  sourceMap: boolean;
  experimentalDecorators: boolean;
  emitDecoratorMetadata: boolean;
  useDefineForClassFields: boolean;
  jsx: string; // "react" | "react-jsx" | "react-jsxdev" | "react-native" | "preserve"
  jsxFactory: string;
  jsxFragmentFactory: string;
  jsxImportSource: string;
  stripInternal: boolean;
}>;

const normalizeDeclaration = ({ declaration, declarationMap, stripInternal }: CompilerOptions): IsolatedDeclarationsOptions => {
  if (declaration) {
    return {
      sourcemap: declarationMap,
      stripInternal,
    };
  }
};

const normalizeDecorator = ({ experimentalDecorators, emitDecoratorMetadata }: CompilerOptions) => {
  const emitDecorator = experimentalDecorators !== null && experimentalDecorators !== undefined;
  if (emitDecorator) {
    return {
      legacy: experimentalDecorators,
      emitDecoratorMetadata,
    };
  }
};

const normalizeJSX = ({ jsx, jsxFactory, jsxFragmentFactory, jsxImportSource }: CompilerOptions) => {
  if (!jsx) {
    return;
  }
  if (jsx === "preserve") {
    return jsx;
  }
  return {
    importSource: jsxImportSource,
    pragmaFrag: jsxFragmentFactory,
    pragma: jsxFactory,
    development: jsx === "react-jsxdev",
  };
};

const migrate = ({
  target,
  declaration,
  declarationMap,
  sourceMap,
  jsxFactory,
  jsxFragmentFactory,
  jsxImportSource,
  experimentalDecorators,
  emitDecoratorMetadata,
  useDefineForClassFields,
  jsx,
  stripInternal,
}: CompilerOptions): TransformOptions => {
  return {
    target: target?.toLowerCase() || "esnext",
    sourcemap: sourceMap,
    sourceType: "module",
    assumptions: {
      setPublicClassFields: !useDefineForClassFields,
    },
    jsx: normalizeJSX({ jsx, jsxFactory, jsxFragmentFactory, jsxImportSource }),
    decorator: normalizeDecorator({ experimentalDecorators, emitDecoratorMetadata }),
    typescript: {
      removeClassFieldsWithoutInitializer: !useDefineForClassFields,
      rewriteImportExtensions: true,
      declaration: normalizeDeclaration({ declaration, declarationMap, stripInternal }),
    },
  };
};

export default migrate;
