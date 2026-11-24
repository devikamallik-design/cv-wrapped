import type { Wrapped } from "./wrapped";

export type AnalyseResponse =
  | { ok: true; file: { name: string; pages: number }; wrapped: Wrapped; rewrite: string | null }
  | { ok: false; code: string; message: string };
