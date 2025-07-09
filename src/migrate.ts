export { default } from "tsconfig-migrate/oxc.js";
import type { CompilerOptions as LooseType} from "tsconfig-migrate/loose-types.js";

export interface CompilerOptions extends LooseType {
  customConditions?: string[];
}
