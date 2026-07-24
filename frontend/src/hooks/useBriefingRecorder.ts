import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

// Gravador do áudio da reunião para o briefing.
//
// Um ÚNICO gravador contínuo. A versão anterior abria um MediaRecorder novo a
// cada segmento, e o intervalo entre parar um e abrir o outro engolia frações
// de segundo de áudio a cada emenda — palavras perdidas o tempo todo. Aqui o
// microfone é gravado sem interrupção.
//
// Para o texto aparecer durante a reunião (e não só no fim), o áudio acumulado
// da JANELA atual é transcrito de tempos em tempos. Cada envio manda a janela
// inteira desde o início dela, então o Whisper tem contexto e não corta
// palavra no meio. A cada JANELA_MAX_S a janela é fechada: o texto vira
// definitivo e uma janela nova começa, para o áudio enviado não crescer sem
// limite. A troca de janela é o único ponto com um respiro mínimo, raro.
//
// O relógio que dispara os envios roda num Web Worker: timers de aba em segundo
// plano são congelados pelo Chrome, e durante a reunião a aba do Vexo fica atrás
// da aba do Meet.
//
// O áudio nunca é guardado. Vira texto e é descartado, no navegador e no servidor.

const ENVIAR_A_CADA_S = 6;   // transcreve a janela atual a cada 6s
const JANELA_MAX_S = 90;     // fecha a janela e começa outra a cada 90s
const BITS_POR_SEGUNDO = 96000;

export interface EstadoGravacao {
  gravando: boolean;
  transcrevendo: boolean;
  segundos: number;
  erro: string | null;
  suportado: boolean;
}

/** aoAtualizar recebe o texto COMPLETO (prefixo + janelas fechadas + janela atual). */
export function useBriefingRecorder(aoAtualizar: (textoCompleto: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pararRef = useRef(false);

  const pedacosRef = useRef<BlobPart[]>([]); // áudio da janela atual
  const prefixoRef = useRef("");             // texto colado/editado antes de gravar
  const finalizadoRef = useRef("");          // texto das janelas já fechadas
  const janelaTextoRef = useRef("");         // texto da janela atual (substituído a cada envio)
  const enviandoRef = useRef(false);         // evita dois envios simultâneos

  const aoAtualizarRef = useRef(aoAtualizar);
  aoAtualizarRef.current = aoAtualizar;

  const suportado =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const escolherMime = () => {
    const opcoes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return opcoes.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  };

  const compor = () =>
    [prefixoRef.current, finalizadoRef.current, janelaTextoRef.current]
      .map((t) => t.trim())
      .filter(Boolean)
      .join(" ");

  const transcreverJanela = useCallback(async (token: string) => {
    if (enviandoRef.current) return;
    const pedacos = pedacosRef.current;
    if (pedacos.length === 0) return;

    const blob = new Blob(pedacos, { type: (pedacos[0] as Blob)?.type || "audio/webm" });
    if (blob.size < 2500) return;

    enviandoRef.current = true;
    setTranscrevendo(true);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => reject(new Error("Falha ao ler o áudio."));
        fr.readAsDataURL(blob);
      });
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
      // Substitui o texto da janela: como reenviamos a janela inteira, cada
      // resposta é a transcrição completa dela, mais precisa que a anterior.
      janelaTextoRef.current = texto;
      aoAtualizarRef.current(compor());
    } catch (e: any) {
      setErro(e?.message || "Falha na transcrição do trecho.");
    } finally {
      enviandoRef.current = false;
      setTranscrevendo(false);
    }
  }, []);

  const pararTudo = useCallback(() => {
    pararRef.current = true;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* já encerrado */
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
    async (obterToken: () => Promise<string>, textoInicial = "") => {
      setErro(null);
      if (!suportado) {
        setErro("Este navegador não permite gravar áudio. Use o Chrome no computador.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // echoCancellation REMOVE o som que sai das caixas. A voz do cliente
            // vem justamente das caixas, então deixá-lo ligado apaga a metade
            // mais importante da reunião. Este track é só para gravar; o Meet
            // mantém o track dele com cancelamento, então a chamada não ecoa.
            echoCancellation: false,
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
      pedacosRef.current = [];
      prefixoRef.current = textoInicial.trim();
      finalizadoRef.current = "";
      janelaTextoRef.current = "";
      setGravando(true);
      setSegundos(0);

      const mime = escolherMime();
      const token = await obterToken();

      const iniciarJanela = () => {
        if (pararRef.current || !streamRef.current) return;
        pedacosRef.current = [];
        const rec = new MediaRecorder(streamRef.current, {
          ...(mime ? { mimeType: mime } : {}),
          audioBitsPerSecond: BITS_POR_SEGUNDO,
        });
        recorderRef.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) pedacosRef.current.push(e.data);
        };
        rec.onstop = () => {
          // Fim da janela (ou parada manual): fecha o texto atual e, se ainda
          // gravando, abre a próxima janela.
          if (janelaTextoRef.current) {
            finalizadoRef.current = [finalizadoRef.current, janelaTextoRef.current]
              .map((t) => t.trim())
              .filter(Boolean)
              .join(" ");
            janelaTextoRef.current = "";
          }
          void transcreverJanela(token); // último trecho da janela que fechou
          if (!pararRef.current) iniciarJanela();
        };
        // timeslice curto: os dados chegam a cada 1s, então a janela em curso já
        // tem áudio para transcrever antes de fechar.
        rec.start(1000);
      };

      // Worker: um tick por segundo mesmo com a aba em segundo plano.
      const worker = new Worker(
        URL.createObjectURL(
          new Blob(["setInterval(()=>postMessage(0),1000)"], { type: "application/javascript" })
        )
      );
      workerRef.current = worker;
      let segJanela = 0;
      let total = 0;
      worker.onmessage = () => {
        if (pararRef.current) return;
        total += 1;
        segJanela += 1;
        setSegundos(total);
        if (segJanela >= JANELA_MAX_S) {
          segJanela = 0;
          const rec = recorderRef.current;
          if (rec && rec.state !== "inactive") rec.stop(); // fecha janela -> onstop abre a próxima
        } else if (segJanela % ENVIAR_A_CADA_S === 0) {
          void transcreverJanela(token);
        }
      };

      iniciarJanela();
    },
    [suportado, transcreverJanela]
  );

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
