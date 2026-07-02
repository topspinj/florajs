import type { ParseWarning } from "./types.js";

/**
 * Thrown by the public APIs when `strict` is enabled and the input has
 * error-severity diagnostics or an unsupported diagram type.
 */
export class FloraParseError extends Error {
  /** All diagnostics collected while parsing, including info-severity ones. */
  readonly warnings: ParseWarning[];

  constructor(message: string, warnings: ParseWarning[] = []) {
    super(message);
    this.name = "FloraParseError";
    this.warnings = warnings;
  }
}

export function checkStrict(
  strict: boolean | undefined,
  warnings: ParseWarning[],
  unsupportedType?: string,
): void {
  if (!strict) return;
  if (unsupportedType !== undefined) {
    throw new FloraParseError(
      `Unsupported diagram type: ${unsupportedType} — Flora currently supports flowcharts only`,
      warnings,
    );
  }
  const errors = warnings.filter((w) => w.severity === "error");
  if (errors.length > 0) {
    const first = errors[0]!;
    throw new FloraParseError(
      `Diagram has ${errors.length} parse error${errors.length === 1 ? "" : "s"}; first at line ${first.line}: ${first.message}`,
      warnings,
    );
  }
}
