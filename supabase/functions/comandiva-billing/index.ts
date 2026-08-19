import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "legacy_billing_endpoint_retired", replacement: "comandiva-stripe" }), { status: 410, headers: { "content-type": "application/json", "cache-control": "no-store" } }));
