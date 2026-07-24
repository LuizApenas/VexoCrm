import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

// Gravador do áudio da reunião para o briefing.
//
// Grava o MICROFONE em SEGMENTOS curtos e transcreve um a um durante a reunião,
// em vez de mandar tudo no fim. Duas razões:
//   1. o operador vê o texto surgindo e já pode corrigir;
//   2. contorna o limite de tamanho por arquivo da API de transcrição, que uma
//      reunião inteira estouraria.
//
// Cada segmento é gravado com um MediaRecorder novo. Isso é deliberado: pedaços
// subsequentes de um MESMO MediaRecorder não têm cabeçalho e não são
// decodificáveis sozinhos, então seriam recusados pela transcrição.
//
// O áudio nunca é guardado. Vira texto e é descartado, no navegador e no
// servidor.

const SEGUNDOS_POR_SEGMENTO = 120;

export interface EstadoGravacao {
  gravando: boolean;
  transcrevendo: boolean;
  segundos: number;
  erro: string | null;
  suportado: boolean;
}

export function useBriefingRecorder(aoTranscrever: (trecho: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pararRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const aoTranscreverRef = useRef(aoTranscrever);
  aoTranscreverRef.current = aoTranscrever;

  const suportado =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const escolherMime = () => {
    const opcoes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return opcoes.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  };

  const enviarSegmento = useCallback(async (blob: Blob, token: string) => {
    if (blob.size < 2000) return; // silêncio/segmento residual
    const base64: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Falha ao ler o áudio."));
      fr.readAsDataURL(blob);
    });

    setTranscrevendo(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/geracao-digital/briefing/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio_base64: base64, mime_type: blob.type }),
      });
      if (!resp.ok) {
        const det = await resp.json().catch(() => null);
        throw new Error(det?.error || "Não foi possível transcrever este trecho.");
      }
      const json = await resp.json();
      const texto = String(json?.texto || "").trim();
      if (texto) aoTranscreverRef.current(texto);
    } catch (e: any) {
      setErro(e?.message || "Falha na transcrição do trecho.");
    } finally {
      setTranscrevendo(false);
    }
  }, []);

  const pararTudo = useCallback(() => {
    pararRef.current = true;
    try {
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    } catch {
      /* recorder já encerrado */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setGravando(false);
  }, []);

  const iniciar = useCallback(
    async (obterToken: () => Promise<string>) => {
      setErro(null);
      if (!suportado) {
        setErro("Este navegador não permite gravar áudio. Use o Chrome no computador.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        setErro("Permissão de microfone negada. Libere o acesso e tente de novo.");
        return;
      }

      streamRef.current = stream;
      pararRef.current = false;
      setGravando(true);
      setSegundos(0);
      timerRef.current = window.setInterval(() => setSegundos((s) => s + 1), 1000);

      const mime = escolherMime();
      const token = await obterToken();

      // Um MediaRecorder por segmento, encadeados: ao fechar um, envia e abre o
      // próximo, até o operador parar.
      const gravarSegmento = () => {
        if (pararRef.current || !streamRef.current) return;
        const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
        recorderRef.current = rec;
        const pedacos: BlobPart[] = [];

        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) pedacos.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(pedacos, { type: rec.mimeType || "audio/webm" });
          void enviarSegmento(blob, token);
          if (!pararRef.current) gravarSegmento();
        };

        rec.start();
        window.setTimeout(() => {
          if (rec.state !== "inactive") rec.stop();
        }, SEGUNDOS_POR_SEGMENTO * 1000);
      };

      gravarSegmento();
    },
    [enviarSegmento, suportado]
  );

  // Encerra a captura se o componente sair da tela: sem microfone aberto à toa.
  useEffect(() => () => pararTudo(), [pararTudo]);

  return {
    gravando,
    transcrevendo,
    segundos,
    erro,
    suportado,
    iniciar,
    parar: pararTudo,
    limparErro: () => setErro(null),
  };
}
