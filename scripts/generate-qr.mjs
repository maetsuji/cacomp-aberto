#!/usr/bin/env node
// Gera os dois QR Codes estáticos do CA-Aberto (Seção 2.1 do SDD):
// um para o QR interno (action=open) e outro para o externo (action=close).
//
// Uso:
//   npm run generate-qr                 -> lê .env.local, aponta pro localhost
//   npm run generate-qr -- --host=SEU_IP -> aponta pra outra máquina na rede
//   npm run generate-qr:prod            -> lê .env.production.local, aponta pro domínio real
//
// Os PNGs vão para qrcodes/ (gitignored) — nunca versione QR codes com
// tokens reais no repositório.

import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import QRCode from "qrcode";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const isProd = args.includes("--prod");

function loadEnv(file) {
  const env = {};
  let content;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    return env;
  }
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.split(/\s+#/)[0].trim();
  }
  return env;
}

// Em produção, tenta .env.production.local; se não existir, cai para
// .env.local — nesse caso os tokens PRECISAM ser os mesmos configurados
// nas variáveis de ambiente do projeto na Vercel, senão o QR gera uma
// URL que o servidor vai rejeitar como token inválido.
let envFile = isProd ? ".env.production.local" : ".env.local";
let env = loadEnv(path.join(root, envFile));
if (isProd && Object.keys(env).length === 0) {
  console.warn(
    "⚠ .env.production.local não encontrado — usando tokens de .env.local.\n" +
      "  Confirme que são os MESMOS valores cadastrados na Vercel."
  );
  envFile = ".env.local";
  env = loadEnv(path.join(root, envFile));
}

const hostArg = args.find((a) => a.startsWith("--host="))?.split("=")[1];
const baseUrl = isProd
  ? env.SITE_URL ?? "https://cacomp-aberto.vercel.app" // URL real do deploy
  : `http://${hostArg ?? "localhost:3000"}`;

const targets = [
  {
    label: "QR INTERNO (dentro do CA → reporta ABERTO)",
    action: "open",
    token: env.REPORT_TOKEN_INTERNAL,
    file: "qr-interno-open.png",
  },
  {
    label: "QR EXTERNO (porta do CA → reporta FECHADO)",
    action: "close",
    token: env.REPORT_TOKEN_EXTERNAL,
    file: "qr-externo-close.png",
  },
];

const outDir = path.join(root, "qrcodes");
mkdirSync(outDir, { recursive: true });

for (const t of targets) {
  console.log(`\n${t.label}`);

  if (!t.token) {
    console.error(`  ✗ token ausente em ${envFile} — pulando.`);
    continue;
  }

  const url = `${baseUrl}/report?action=${t.action}&token=${t.token}`;
  const outPath = path.join(outDir, t.file);

  await QRCode.toFile(outPath, url, { width: 512, margin: 2 });
  console.log(`  ✓ PNG salvo em qrcodes/${t.file}`);
  console.log(`  URL: ${url}`);
  console.log(await QRCode.toString(url, { type: "terminal", small: true }));
}
