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

// O PRIMEIRO segmento é curto de propósito: o operador precisa ver texto
// aparecendo em segundos para confiar que está funcionando. Antes era 120s para
// todos, então o primeiro trecho só surgia depois de dois minutos inteiros.
const SEGUNDOS_PRIMEIRO_SEGMENTO = 12;
const SEGUNDOS_POR_SEGMENTO = 25;

// Qualidade de áudio para TRANSCRIÇÃO, que não é a mesma coisa que para uma
// chamada de voz. Opus mono a 64 kbps já é bem acima do que o Whisper precisa e
// evita o bitrate baixo que o navegador escolhe sozinho.
const BITS_POR_SEGUNDO = 64000;

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
  // Ticker num Web Worker. O corte dos segmentos NÃO pode depender de
  // setInterval/setTimeout da página: durante a reunião a aba do Vexo fica em
  // segundo plano (o Meet está na frente) e o Chrome congela os timers de abas
  // em segundo plano. Era por isso que a transcrição só aparecia depois de
  // parar: o corte nunca disparava e o primeiro segmento gravava a reunião
  // toda. Timer de Worker continua rodando em segundo plano.
  const workerRef = useRef<Worker | null>(null);
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
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
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
          audio: {
            // echoCancellation REMOVE o que sai das caixas de som. Como a voz do
            // cliente vem justamente das caixas, deixá-lo ligado apagava a
            // metade mais importante da reunião. Este track é só para gravar; o
            // Meet continua com o track dele, com cancelamento ativo, então a
            // chamada não passa a ecoar para o outro lado.
            echoCancellation: false,
            // Estes dois ajudam no que o Conrado relatou: ruído em volta e voz
            // distante saindo baixa.
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch {
        setErro("Permissão de microfone negada. Libere o acesso e tente de novo.");
        return;
      }

      streamRef.current = stream;
      pararRef.current = false;
      setGravando(true);
      setSegundos(0);

      const mime = escolherMime();
      const token = await obterToken();

      // Worker que emite um "tick" por segundo mesmo com a aba em segundo plano.
      const worker = new Worker(
        URL.createObjectURL(
          new Blob(["setInterval(()=>postMessage(0),1000)"], { type: "application/javascript" })
        )
      );
      workerRef.current = worker;

      // Um MediaRecorder por segmento, encadeados: cada segmento é um arquivo
      // completo (com cabeçalho), decodificável sozinho pela transcrição.
      let primeiro = true;
      let segAtual = 0;
      let limiteAtual = SEGUNDOS_PRIMEIRO_SEGMENTO;

      const gravarSegmento = () => {
        if (pararRef.current || !streamRef.current) return;
        const rec = new MediaRecorder(streamRef.current, {
          ...(mime ? { mimeType: mime } : {}),
          audioBitsPerSecond: BITS_POR_SEGUNDO,
        });
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
        segAtual = 0;
        limiteAtual = primeiro ? SEGUNDOS_PRIMEIRO_SEGMENTO : SEGUNDOS_POR_SEGMENTO;
        primeiro = false;
      };

      worker.onmessage = () => {
        setSegundos((s) => s + 1);
        segAtual += 1;
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive" && segAtual >= limiteAtual) {
          rec.stop(); // dispara onstop -> envia e abre o próximo segmento
        }
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
