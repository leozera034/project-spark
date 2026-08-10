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
const suspicious = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"]?[A-Za-z0-9._-]{20,}/i,
  /QA_PREVIEW_ACCESS_KEY\s*=\s*['\"]?\S{8,}/i,
  /QA_SESSION_SECRET\s*=\s*['\"]?\S{8,}/i,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
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
}

console.log("Repository hygiene checks passed.");
