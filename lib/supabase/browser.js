"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  if (!browserClient) browserClient = createClient(url, publishableKey);
  return browserClient;
}
