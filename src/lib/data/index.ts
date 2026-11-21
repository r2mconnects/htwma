import type { DataProvider } from "./provider";
import { createLocalProvider } from "./local/local-provider";
import { createSupabaseProvider } from "./supabase/supabase-provider";

/**
 * ===== BACKEND SWITCH =====
 * Default: "local" (browser storage). To use Supabase, set in your .env:
 *   VITE_DATA_BACKEND=supabase
 *   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
 * Nothing else in the app needs to change.
 */
function pickProvider(): DataProvider {
  const env = import.meta.env;
  const backend = env["VITE_DATA_BACKEND"] as string | undefined;
  const url = env["VITE_SUPABASE_URL"] as string | undefined;
  const key = (env["VITE_SUPABASE_ANON_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"]) as string | undefined;
  if (backend === "supabase") {
    if (!url || !key) {
      console.warn("VITE_DATA_BACKEND=supabase but Supabase URL/key are missing — falling back to local storage.");
      return createLocalProvider();
    }
    return createSupabaseProvider(url, key);
  }
  return createLocalProvider();
}

export const db: DataProvider = pickProvider();
export * from "./types";
