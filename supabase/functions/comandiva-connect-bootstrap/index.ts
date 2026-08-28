import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({ ok: false, error: "bootstrap_retired", replacement: "comandiva-stripe" }),
  { status: 410, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
));
