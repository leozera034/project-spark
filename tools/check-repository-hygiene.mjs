import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const forbiddenTrackedEnv = tracked.filter(
  (file) => file === ".env" || (/^\.env\./.test(file) && file !== ".env.example"),
);

if (forbiddenTrackedEnv.length) {
  console.error("Tracked environment files are forbidden:", forbiddenTrackedEnv.join(", "));
  process.exit(1);
}

const sourceFiles = tracked.filter((file) => /\.(?:ts|tsx|js|mjs|cjs|json|md|sql|toml|ya?ml)$/.test(file));
// Match concrete secret material, not documentation that merely names an env var.
const suspicious = [
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

// VITE_* variables are compiled into browser bundles. Privileged Supabase or
// private-key-style environment names must never be introduced there, even if
// the actual value is supplied only at deploy time.
const browserSecretEnvNames = [
  /\bVITE_SUPABASE_SERVICE_ROLE(?:_KEY)?\b/i,
  /\bVITE_SUPABASE_SECRET(?:_KEY)?\b/i,
  /\bVITE_[A-Z0-9_]*PRIVATE_KEY\b/i,
];

for (const file of sourceFiles) {
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (suspicious.some((pattern) => pattern.test(content))) {
    console.error(`Potential hard-coded secret detected in ${file}`);
    process.exit(1);
  }
  if (browserSecretEnvNames.some((pattern) => pattern.test(content))) {
    console.error(`Privileged secret environment name exposed to browser build in ${file}`);
    process.exit(1);
  }
}

console.log("Repository hygiene checks passed.");
