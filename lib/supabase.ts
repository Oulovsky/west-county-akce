import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);

  return browserClient;
}

export function createBrowserClient() {
  return getBrowserClient();
}

export function createClient() {
  return getBrowserClient();
}

export const supabase = getBrowserClient();

export default supabase;