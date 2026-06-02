export type LuxelDiagnostic = {
  code: string;
  message: string;
};

export class LuxelCompileError extends Error {
  readonly diagnostics: LuxelDiagnostic[];

  constructor(diagnostics: LuxelDiagnostic[]) {
    super(diagnostics.map((d) => `[${d.code}] ${d.message}`).join("\n"));
    this.name = "LuxelCompileError";
    this.diagnostics = diagnostics;
  }
}
