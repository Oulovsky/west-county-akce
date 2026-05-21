import type { PostgrestError } from "@supabase/supabase-js";

export type SkladTableQueryResult<T> = {
  data: T[];
  error: PostgrestError | null;
};

export function isMissingSkladResourceError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the table") ||
    lower.includes("could not find the function") ||
    lower.includes("does not exist") ||
    (lower.includes("relation") && lower.includes("exist"))
  );
}

export function logSkladQueryFallback(label: string, error: PostgrestError): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[sklad] ${label}:`, error.message);
  }
}

type SkladTableQueryResponse<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

export async function runSkladTableQuery<T>(
  label: string,
  query: () => PromiseLike<SkladTableQueryResponse<T>>
): Promise<SkladTableQueryResult<T>> {
  const result = await query();

  if (!result.error) {
    return { data: result.data ?? [], error: null };
  }

  if (isMissingSkladResourceError(result.error.message)) {
    logSkladQueryFallback(label, result.error);
    return { data: [], error: null };
  }

  return { data: [], error: result.error };
}
