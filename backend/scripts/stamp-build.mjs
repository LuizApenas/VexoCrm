#!/usr/bin/env node
// Grava backend/build-info.json com o commit e a data do momento em que roda.
//
// Existe como PLANO B do carimbo de build: o caminho preferido sao os build-args
// GIT_COMMIT/BUILD_TIME do Dockerfile, mas o Easypanel nao os passa hoje e o
// carimbo sai "desconhecido". Este arquivo e lido pelo servidor quando as env
// vars faltam, entao o deploy volta a ser rastreavel sem depender do painel.
//
// Rodar antes de empurrar:  npm run stamp --prefix backend
// E commitar o build-info.json junto.

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "build-info.json");

function git(comando) {
  try {
    return execSync(comando, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const commit = git("git rev-parse --short HEAD") || "desconhecido";
const branch = git("git rev-parse --abbrev-ref HEAD") || "desconhecido";
const sujo = git("git status --porcelain") !== "";

const info = {
  commit,
  branch,
  // true = havia alteracao nao commitada quando o carimbo foi gerado; o commit
  // registrado nao descreve exatamente o que sera empurrado.
  arvoreSuja: sujo,
  builtAt: new Date().toISOString(),
};

writeFileSync(destino, `${JSON.stringify(info, null, 2)}\n`);
console.log("[stamp-build]", JSON.stringify(info));
if (sujo) {
  console.warn("[stamp-build] atencao: arvore com alteracoes nao commitadas no momento do carimbo.");
}
