/**
 * Typed access to public environment configuration. Reading this module must
 * never throw, even with no `.env.local` at all — the default `dataMode` is
 * "mock", which needs zero configuration. Only `assertSupabaseConfigured()`
 * (called by the Supabase client factories, never at module load) throws,
 * and only when "supabase" mode is explicitly selected without credentials.
 */

export const DATA_MODES = ["mock", "supabase"] as const;
export type DataMode = (typeof DATA_MODES)[number];

function readDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE?.trim() === "supabase" ? "supabase" : "mock";
}

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface PublicEnv {
  dataMode: DataMode;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
}

/** Re-read on every access (not cached at module scope) so tests can mutate `process.env` between calls. */
export function getPublicEnv(): PublicEnv {
  return {
    dataMode: readDataMode(),
    supabaseUrl: readOptional(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: readOptional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getDataMode(): DataMode {
  return getPublicEnv().dataMode;
}

export function isSupabaseConfigured(): boolean {
  const env = getPublicEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'NEXT_PUBLIC_DATA_MODE is set to "supabase" but NEXT_PUBLIC_SUPABASE_URL and/or ' +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Set both in .env.local, or switch " +
        'NEXT_PUBLIC_DATA_MODE back to "mock". See .env.example.',
    );
    this.name = "SupabaseConfigurationError";
  }
}

/** Called by Supabase client factories only — never at module load, so mock mode never crashes on missing credentials. */
export function assertSupabaseConfigured(): void {
  const env = getPublicEnv();
  if (env.dataMode === "supabase" && !(env.supabaseUrl && env.supabaseAnonKey)) {
    throw new SupabaseConfigurationError();
  }
}
