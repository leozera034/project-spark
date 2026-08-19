import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_BODY_BYTES = 128 * 1024;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  // Public provider callback. This onboarding/QA version intentionally performs
  // no business-data mutation until Wamini's authenticity contract is wired.
  if (req.method === "GET" || req.method === "HEAD") {
    if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
    return json(200, { ok: true, service: "comandiva-wamini-webhook", ready: true });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
        "access-control-allow-headers": "content-type,x-signature,x-webhook-signature",
        "access-control-max-age": "600",
      },
    });
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return json(400, { ok: false, error: "body_read_failed" });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  let parsed: unknown = null;
  if (raw.trim()) {
    if (contentType.includes("application/json") || raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")) {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
  }

  // Log only non-sensitive envelope metadata; never echo or persist message body.
  const event = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? String((parsed as Record<string, unknown>).event ?? (parsed as Record<string, unknown>).type ?? (parsed as Record<string, unknown>).key ?? "unknown").slice(0, 100)
    : "unknown";
  console.log("[comandiva-wamini-webhook] callback", {
    event,
    contentType: contentType.slice(0, 100) || null,
    bytes: new TextEncoder().encode(raw).byteLength,
    hasSignatureHeader: Boolean(req.headers.get("x-signature") || req.headers.get("x-webhook-signature")),
    userAgent: req.headers.get("user-agent")?.slice(0, 120) ?? null,
  });

  // Provider acknowledgement only. Processing remains fail-closed until webhook
  // authenticity can be verified from an official Wamini contract/secret.
  return json(200, { ok: true, received: true });
});
