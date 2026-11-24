import type { DataProvider } from "./provider";
import { createSupabaseProvider } from "./supabase/supabase-provider";

const FALLBACK_SUPABASE_URL = "https://szxfrbrppkofeoojzewq.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j-dn9fd240khu7AC5LeASw_JRc8GzsN";

/**
 * Connects the application to the HTWMA Supabase PostgreSQL backend.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)
 * from environment variables, with public project defaults so preview/edge builds work seamlessly.
 * All data access is protected server-side by Supabase Row Level Security (RLS).
 */
function initProvider(): DataProvider {
  const env = import.meta.env;
  const url = (env["VITE_SUPABASE_URL"] as string | undefined)?.trim() || FALLBACK_SUPABASE_URL;
  const key =
    (
      (env["VITE_SUPABASE_ANON_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"]) as string | undefined
    )?.trim() || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  return createSupabaseProvider(url, key);
}

export const db: DataProvider = initProvider();
export * from "./types";
