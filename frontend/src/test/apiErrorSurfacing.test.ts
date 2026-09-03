// Por que o dono só via "Failed to fetch".
//
// O 502 da aplicação sai COM cabeçalho de CORS — app.use(cors()) roda antes de
// toda rota. O erro do navegador vinha do cliente: shouldRetryApiResponse
// tratava QUALQUER 502 como falha de gateway, e fetchApi então repetia a
// chamada no segundo candidato de URL (getApiCandidates). Em produção o
// primeiro candidato é o caminho same-origin, servido pelo rewrite da Vercel; o
// segundo é a URL absoluta do backend, cross-origin. Um 502 legítimo da
// aplicação virava uma segunda requisição cross-origin, e era ESSA que o
// navegador barrava — daí "No 'Access-Control-Allow-Origin' header" seguido de
// ERR_FAILED, escondendo o corpo que o backend tinha mandado.

import { describe, expect, it } from "vitest";
import { shouldRetryApiResponse, readApiErrorMessage } from "@/lib/api";

function resposta(status: number, contentType: string) {
  return { status, headers: { get: () => contentType } } as unknown as Response;
}

function respostaJson(status: number, corpo: unknown) {
  return {
    status,
    headers: { get: () => "application/json" },
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  } as unknown as Response;
}

describe("502 da aplicação não vira retry cross-origin", () => {
  it("502 com corpo JSON NÃO é repetido — é resposta legítima do backend", () => {
    expect(shouldRetryApiResponse(resposta(502, "application/json"))).toBe(false);
  });

  it("503 e 504 com JSON também não", () => {
    expect(shouldRetryApiResponse(resposta(503, "application/json"))).toBe(false);
    expect(shouldRetryApiResponse(resposta(504, "application/json"))).toBe(false);
  });

  it("502 em HTML CONTINUA sendo repetido — aí sim é gateway/proxy", () => {
    expect(shouldRetryApiResponse(resposta(502, "text/html"))).toBe(true);
    expect(shouldRetryApiResponse(resposta(504, "text/html; charset=utf-8"))).toBe(true);
  });

  it("500 em HTML continua repetindo, como antes", () => {
    expect(shouldRetryApiResponse(resposta(500, "text/html"))).toBe(true);
  });

  it("resposta boa nunca é repetida", () => {
    expect(shouldRetryApiResponse(resposta(200, "application/json"))).toBe(false);
    expect(shouldRetryApiResponse(resposta(403, "application/json"))).toBe(false);
  });
});

describe("a tela mostra o motivo do backend, não um genérico", () => {
  it("junta error e reason quando os dois vêm", async () => {
    const msg = await readApiErrorMessage(
      respostaJson(502, {
        success: false,
        error: "Não foi possível gerar o resumo com IA no momento.",
        reason: "Groq HTTP 400: json_validate_failed",
      }),
      "Falha"
    );
    expect(msg).toContain("Não foi possível gerar o resumo com IA no momento.");
    expect(msg).toContain("json_validate_failed");
  });

  it("usa o formato { error: { message, details } } do sendError", async () => {
    const msg = await readApiErrorMessage(
      respostaJson(502, { error: { code: "SUMMARY_FAILED", message: "Resumo falhou", details: "groq timeout" } }),
      "Falha"
    );
    expect(msg).toContain("Resumo falhou");
    expect(msg).toContain("groq timeout");
  });

  it("só o reason já serve", async () => {
    const msg = await readApiErrorMessage(respostaJson(502, { reason: "Prompt não configurado" }), "Falha");
    expect(msg).toBe("Prompt não configurado");
  });

  it("sem nada útil, cai no genérico com o status", async () => {
    const msg = await readApiErrorMessage(respostaJson(502, {}), "Falha ao gerar resumo");
    expect(msg).toBe("Falha ao gerar resumo: 502");
  });

  it("quando details é um objeto de metadados (ex: INVALID_ACCESS_PRESET), mostra a mensagem real sem [object Object]", async () => {
    const msg = await readApiErrorMessage(
      respostaJson(400, {
        error: {
          code: "INVALID_ACCESS_PRESET",
          message: 'Perfil de acesso "admin" não existe. Aceitos: admin_vexo, gestor, operador, parceiro, client_manager, client_operator, client_viewer, pending.',
          details: {
            recebido: "admin",
            aceitos: ["admin_vexo", "gestor", "operador"],
          },
        },
      }),
      "Falha ao criar usuário"
    );
    expect(msg).not.toContain("[object Object]");
    expect(msg).toContain('Perfil de acesso "admin" não existe');
    expect(msg).toBe(
      'Perfil de acesso "admin" não existe. Aceitos: admin_vexo, gestor, operador, parceiro, client_manager, client_operator, client_viewer, pending.'
    );
  });

  it("quando details é objeto com message, extrai a mensagem interna", async () => {
    const msg = await readApiErrorMessage(
      respostaJson(400, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Dados inválidos",
          details: { message: "O e-mail informado já está em uso" },
        },
      }),
      "Falha"
    );
    expect(msg).not.toContain("[object Object]");
    expect(msg).toContain("Dados inválidos (O e-mail informado já está em uso)");
  });
});
