#!/usr/bin/env python3
from __future__ import annotations

import html
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8081


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def public_url() -> str:
    codespace = os.environ.get("CODESPACE_NAME", "").strip()
    forwarding_domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev").strip()
    if codespace:
        return f"https://{codespace}-8080.{forwarding_domain}"
    return "http://localhost:8080"


def page(api_key: str) -> bytes:
    url = public_url()
    escaped_key = html.escape(api_key, quote=True)
    escaped_url = html.escape(url, quote=True)
    return f"""<!doctype html>
<html lang=\"pt-BR\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
  <meta name=\"robots\" content=\"noindex,nofollow,noarchive\">
  <title>Comandiva · Evolution QA</title>
  <style>
    body{{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fcfaf8;color:#1b0d2c;margin:0;padding:24px}}
    main{{max-width:680px;margin:0 auto;background:#fff;border:1px solid #e7e1eb;border-radius:20px;padding:24px;box-shadow:0 8px 28px rgba(27,13,44,.08)}}
    h1{{margin:0 0 8px;font-size:24px}} p{{line-height:1.5;color:#62566c}} label{{display:block;font-size:13px;font-weight:700;margin:18px 0 8px}}
    input{{box-sizing:border-box;width:100%;padding:13px;border:1px solid #d8d0de;border-radius:12px;font:15px ui-monospace,SFMono-Regular,Menlo,monospace;background:#faf8fb}}
    button{{width:100%;margin-top:10px;padding:13px;border:0;border-radius:12px;background:#ff681f;color:#fff;font-weight:800;font-size:15px}}
    .note{{margin-top:18px;padding:12px;border-radius:12px;background:#fff6ef;color:#6d371e;font-size:13px}}
  </style>
</head>
<body>
<main>
  <h1>Evolution QA · configuração</h1>
  <p>Esta página roda somente no Codespace. Mantenha a porta <strong>8081 privada</strong>. Copie a chave abaixo para o segredo <code>EVOLUTION_API_KEY</code> do Supabase.</p>
  <label for=\"url\">EVOLUTION_API_BASE_URL</label>
  <input id=\"url\" readonly value=\"{escaped_url}\">
  <button type=\"button\" onclick=\"navigator.clipboard.writeText(document.getElementById('url').value)\">Copiar URL</button>
  <label for=\"key\">EVOLUTION_API_KEY</label>
  <input id=\"key\" readonly value=\"{escaped_key}\">
  <button type=\"button\" onclick=\"navigator.clipboard.writeText(document.getElementById('key').value)\">Copiar chave</button>
  <div class=\"note\">Não cole essa chave no chat, em issue, commit ou arquivo do repositório.</div>
</main>
</body>
</html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path not in ("/", "/index.html"):
            self.send_response(404)
            self.end_headers()
            return
        env_path = Path(sys.argv[1]).expanduser().resolve()
        try:
            values = read_env(env_path)
            api_key = values.get("EVOLUTION_API_KEY", "")
            if not api_key:
                raise RuntimeError("EVOLUTION_API_KEY ausente")
            body = page(api_key)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            body = b"Configuration unavailable"
            self.send_response(503)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: config-server.py /path/to/runtime.env")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
