import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const BASELINE = "20260810222500_app_error_observability_index.sql";

const entries = (await readdir(MIGRATIONS_DIR))
  .filter((name) => name.endsWith(".sql") && name > BASELINE)
  .sort();

const findings = [];

const checks = [
  {
    name: "RLS desativado",
    pattern: /ALTER\s+TABLE[\s\S]{0,220}?DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
    advice: "Não desative RLS em tabelas expostas. Crie policies explícitas ou documente uma exceção revisada.",
  },
  {
    name: "GRANT ALL para anon",
    pattern: /GRANT\s+ALL(?:\s+PRIVILEGES)?[\s\S]{0,260}?\bTO\s+(?:ROLE\s+)?anon\b/gi,
    advice: "O papel anon não deve receber privilégios amplos.",
  },
  {
    name: "EXECUTE privilegiado para anon",
    // O escopo do match não atravessa `;` para não confundir grants distintos
    // (um GRANT dinâmico para authenticated seguido, mais abaixo, de um grant
    // anônimo deliberado é ruído, não achado).
    pattern: /GRANT\s+EXECUTE\s+ON\s+(?:FUNCTION|PROCEDURE)[^;]{0,320}?\bTO\s+(?:ROLE\s+)?anon\b/gi,
    advice: "RPCs anônimas exigem revisão explícita. Prefira função pública mínima e allowlist deliberada.",
    // Allowlist deliberada: superfícies públicas mínimas do cardápio, sem PII
    // e sem escrita, necessárias antes de qualquer identificação do cliente.
    allow: /^GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(?:check_public_store_slug\s*\(\s*text\s*\)|storefront_delivery_quote\s*\([^)]*\))\s+TO\s+anon\b/i,
  },
  {
    name: "service role/secret literal",
    pattern: /(?:sb_secret_[A-Za-z0-9_-]{12,}|SUPABASE_SERVICE_ROLE_KEY\s*=|service_role\s*[:=]\s*["'][A-Za-z0-9._-]{20,}["'])/gi,
    advice: "Nunca versione service-role keys ou secrets em migration.",
  },
];

for (const name of entries) {
  const path = join(MIGRATIONS_DIR, name);
  const sql = await readFile(path, "utf8");

  for (const check of checks) {
    check.pattern.lastIndex = 0;
    const matches = [...sql.matchAll(check.pattern)];
    for (const match of matches) {
      const matchedText = match[0];
      if (check.allow?.test(matchedText)) continue;

      const before = sql.slice(0, match.index ?? 0);
      const line = before.split("\n").length;
      findings.push({ file: name, line, check: check.name, advice: check.advice });
    }
  }
}

if (findings.length > 0) {
  console.error("Database migration safety checks failed:\n");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} — ${finding.check}`);
    console.error(`  ${finding.advice}`);
  }
  console.error(
    "\nSe uma exposição anônima for realmente necessária, faça uma revisão explícita e adapte a regra de forma específica; não desative o gate inteiro.",
  );
  process.exit(1);
}

console.log(
  entries.length === 0
    ? `Migration safety checks passed. No migrations newer than ${BASELINE}.`
    : `Migration safety checks passed for ${entries.length} migration(s) newer than ${BASELINE}.`,
);
