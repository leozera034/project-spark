const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!baseUrl) {
  console.log("SMOKE_BASE_URL not configured; remote smoke skipped.");
  process.exit(0);
}

const routes = [
  "/api/health",
  "/",
  "/entrar/loja",
  "/entrar/entregador",
  "/entrar/admin",
  "/criar-loja",
];
const forbiddenBodies = [
  "This page didn't load",
  "Something went wrong on our end",
  "Internal Server Error",
  "Application error",
];

let failed = false;

for (const path of routes) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "PediuAqui-Production-Smoke/1.0" },
    });
    const body = await response.text();
    const forbidden = forbiddenBodies.find((value) => body.includes(value));
    let invalidHealth = false;

    if (path === "/api/health" && response.ok) {
      try {
        const payload = JSON.parse(body);
        invalidHealth = payload?.ok !== true || payload?.service !== "pediu-aqui";
      } catch {
        invalidHealth = true;
      }
    }

    if (!response.ok || forbidden || !body.trim() || invalidHealth) {
      failed = true;
      console.error(
        `✗ ${path}: HTTP ${response.status}${forbidden ? `; encontrou “${forbidden}”` : ""}${invalidHealth ? "; health inválido" : ""}`,
      );
    } else {
      console.log(`✓ ${path}: HTTP ${response.status}`);
    }
  } catch (error) {
    failed = true;
    console.error(`✗ ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
console.log("Production smoke checks passed.");
