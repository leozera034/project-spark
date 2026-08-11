import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow",
};

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            service: "pediu-aqui",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: HEADERS },
        ),
      HEAD: async () => new Response(null, { status: 200, headers: HEADERS }),
    },
  },
});
