import { spawn } from "node:child_process";
import { resolve } from "node:path";

const host = "127.0.0.1";
const port = 4173;
const origin = `http://${host}:${port}`;

const routes = [
  { path: "/api/health", status: 200 },
  { path: "/entrar/loja", status: 200 },
  { path: "/entrar/entregador", status: 200 },
  { path: "/entrar/admin", status: 200 },
  { path: "/criar-loja", status: 200 },
  { path: "/", status: 200 },
];

const forbiddenBodies = [
  "This page didn't load",
  "Something went wrong on our end",
  "Internal Server Error",
  "Missing Supabase environment variable",
];

const env = {
  ...process.env,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "http://127.0.0.1:9",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ci_smoke_only",
  SUPABASE_URL: process.env.SUPABASE_URL || "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ci_smoke_only",
};

const viteBin = resolve("node_modules/vite/bin/vite.js");
const child = spawn(
  process.execPath,
  [viteBin, "--host", host, "--port", String(port), "--strictPort"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function request(path, timeoutMs = 8_000) {
  return fetch(`${origin}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "PediuAqui-CI-Smoke/1.0" },
  });
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Servidor encerrou antes do smoke test.\n${output}`);
    }
    try {
      const response = await request("/api/health", 2_500);
      if (response.status === 200) return;
    } catch {
      // Ainda inicializando.
    }
    await sleep(500);
  }
  throw new Error(`Timeout iniciando servidor de smoke test.\n${output}`);
}

async function assertRoute({ path, status }) {
  const response = await request(path);
  const body = await response.text();

  if (response.status !== status) {
    throw new Error(`${path}: esperado HTTP ${status}, recebido ${response.status}.`);
  }

  for (const forbidden of forbiddenBodies) {
    if (body.includes(forbidden)) {
      throw new Error(`${path}: resposta contém tela/erro proibido: ${forbidden}`);
    }
  }

  if (!body.trim()) {
    throw new Error(`${path}: resposta vazia.`);
  }

  if (path === "/api/health") {
    const payload = JSON.parse(body);
    if (payload?.ok !== true || payload?.service !== "pediu-aqui") {
      throw new Error("/api/health: payload inválido.");
    }
  }

  console.log(`✓ ${path} → ${response.status}`);
}

try {
  await waitForServer();
  for (const route of routes) await assertRoute(route);
  console.log("Critical route smoke checks passed.");
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    sleep(3_000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
