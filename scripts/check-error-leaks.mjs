#!/usr/bin/env node
/**
 * §4.4 — Garde anti-régression « fuite de message d'erreur technique ».
 *
 * Interdit, dans les ÉCRANS et COMPOSANTS UI (là où l'on rend du texte à
 * l'utilisateur), l'affichage direct d'une exception : `error.message`,
 * `(e as Error).message`, `err.toString()`… Tout message d'erreur DOIT passer
 * par `toUserMessage()` / `userMessage()` puis `ErrorState` (voir errorMessages.ts).
 *
 * C'est ce garde-fou qui empêche le bug « java.net.NoRouteToHostException à
 * l'écran » de revenir une 3ᵉ fois. Lancer via `npm run lint:errors`.
 *
 * Portée : src/screens + src/ui uniquement (la couche data manipule
 * légitimement `.message` pour les LOGS techniques, jamais pour l'UI).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src/screens", "src/ui", "src/state"];

// Motifs interdits (accès brut à une exception pour affichage).
const FORBIDDEN = [
  { re: /\bas\s+Error\s*\)\s*\.message\b/, msg: "(e as Error).message — utilise toUserMessage(e)" },
  { re: /\b(?:e|err|error|ex)\.message\b/, msg: ".message brut — utilise toUserMessage(err)" },
  { re: /\b(?:e|err|error|ex)\.toString\(\)/, msg: ".toString() sur une erreur — utilise toUserMessage(err)" },
];

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/eslint-disable|check-error-leaks-allow/.test(line)) return;
    for (const { re, msg } of FORBIDDEN) {
      if (re.test(line)) violations.push({ file: file.replace(ROOT + "\\", "").replace(ROOT + "/", ""), line: i + 1, msg, src: line.trim() });
    }
  });
}

if (violations.length) {
  console.error(`\n✖ ${violations.length} fuite(s) de message d'erreur technique détectée(s) :\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.msg}\n    > ${v.src}`);
  console.error("\nTout affichage d'erreur doit passer par toUserMessage()/ErrorState.\n");
  process.exit(1);
}
console.log(`✓ Aucune fuite de message d'erreur brut (${files.length} fichiers scannés).`);
