#!/usr/bin/env node
// Impressao digital do codigo de src/.
//
// Existe porque o carimbo por SHA nao funcionou: o Easypanel nao passa build-args,
// o ARG do Dockerfile tinha default "desconhecido" (entao a env var SEMPRE existia
// com esse valor e vencia a precedencia), e o build-info.json era gerado antes do
// commit — gravava o commit anterior. Tres mecanismos, nenhum confiavel.
//
// Um hash do conteudo responde a pergunta real: "o que roda e igual ao que esta em
// main?". Nao depende de build-arg, de .git nem de hook.
//
// DETERMINISMO — so entram caminho e conteudo:
//   - caminhos relativos com "/" (mesmo resultado em Linux e macOS)
//   - ordenacao estavel por byte do caminho
//   - conteudo lido como BUFFER (nao string): sem normalizacao de encoding
//   - NADA de mtime, permissao, dono, inode ou ordem do sistema de arquivos
//
// Uso:
//   node scripts/codehash.mjs           imprime o hash
//   node scripts/codehash.mjs --write   grava em code-hash.txt (usado no build)

import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath } from "url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const alvo = join(raiz, "src");

function listarArquivos(dir) {
  const encontrados = [];
  // withFileTypes evita um stat por entrada e nao muda o resultado.
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...listarArquivos(caminho));
    } else if (entrada.isFile()) {
      encontrados.push(caminho);
    }
    // Symlink e socket ficam de fora: nao sao codigo e variam por ambiente.
  }
  return encontrados;
}

export function calcularCodeHash() {
  const arquivos = listarArquivos(alvo)
    // Caminho relativo e com "/" para o hash nao mudar entre sistemas.
    .map((abs) => relative(raiz, abs).split(sep).join("/"))
    // Ordenacao por code unit, estavel e independente de locale.
    .sort();

  const hash = createHash("sha256");
  for (const caminho of arquivos) {
    const conteudo = readFileSync(join(raiz, caminho));
    // Caminho e tamanho entram junto com o conteudo: sem isso, mover uma linha
    // entre dois arquivos daria o mesmo hash.
    hash.update(caminho, "utf8");
    hash.update("\0");
    hash.update(String(conteudo.length), "utf8");
    hash.update("\0");
    hash.update(conteudo);
    hash.update("\0");
  }

  return `${hash.digest("hex").slice(0, 16)}`;
}

const executadoDireto = process.argv[1] && statSync(process.argv[1]).isFile()
  && fileURLToPath(import.meta.url) === process.argv[1];

if (executadoDireto) {
  const codeHash = calcularCodeHash();
  if (process.argv.includes("--write")) {
    writeFileSync(join(raiz, "code-hash.txt"), `${codeHash}\n`);
  }
  console.log(codeHash);
}
