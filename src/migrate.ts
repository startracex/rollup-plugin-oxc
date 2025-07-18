export { default } from "tsconfig-migrate/oxc.js";
import type { CompilerOptions as LooseTypes } from "tsconfig-migrate/loose-types.js";

export interface CompilerOptions extends LooseTypes {
  paths?: Record<string, string[]>;
}
