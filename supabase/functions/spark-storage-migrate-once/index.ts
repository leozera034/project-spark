import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retired QA migration endpoint.
// Kept as an explicit tombstone because the current Supabase connector does not
// expose physical Edge Function deletion. It performs no database, Storage or
// secret access and always returns HTTP 410.
Deno.serve(() =>
  new Response(
    JSON.stringify({ ok: false, error: "migration_endpoint_retired" }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  ),
);
