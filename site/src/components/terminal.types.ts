// Shared TerminalLine type. Importing from .astro files in TypeScript context
// is awkward; a plain .ts file gives us a clean import surface for the pages
// that build their own line arrays.
export type TerminalLine =
  | { kind: "prompt"; cwd?: string; cmd?: string }
  | { kind: "out";    text: string; cls?: string }
  | { kind: "ok";     text: string }
  | { kind: "blank" };
