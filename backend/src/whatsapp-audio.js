import { createDecipheriv, createHmac, hkdfSync, timingSafeEqual } from "crypto";
import https from "https";
import fetch from "node-fetch";
import FormData from "form-data";

const HKDF_INFO = Buffer.from("WhatsApp Audio Keys", "utf8");
const HKDF_SALT = Buffer.alloc(32, 0);
const HKDF_LENGTH = 112;
const MAC_LENGTH = 10;
const HEADER_LENGTHS = [0, 10];
const GROQ_TRANSCRIPT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export class TranscriptionError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "TranscriptionError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeMediaKey(mediaKey) {
  if (Buffer.isBuffer(mediaKey)) {
    return mediaKey;
  }

  if (Array.isArray(mediaKey)) {
    return Buffer.from(mediaKey);
  }

  if (!isPlainObject(mediaKey)) {
    throw new TranscriptionError(
      400,
      "INVALID_MEDIA_KEY",
      "mediaKey must be an indexed object or array of bytes"
    );
  }

  const keys = Object.keys(mediaKey)
    .map((key) => Number.parseInt(key, 10))
    .filter((key) => Number.isInteger(key) && key >= 0)
    .sort((a, b) => a - b);

  if (keys.length === 0) {
    throw new TranscriptionError(400, "INVALID_MEDIA_KEY", "mediaKey is empty");
  }

  const values = keys.map((key) => {
    const value = mediaKey[key];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new TranscriptionError(
        400,
        "INVALID_MEDIA_KEY",
        "mediaKey must contain integers between 0 and 255"
      );
    }
    return value;
  });

  const mediaKeyBuffer = Buffer.from(values);
  if (mediaKeyBuffer.length !== 32) {
    throw new TranscriptionError(
      400,
      "INVALID_MEDIA_KEY",
      `mediaKey must contain 32 bytes, received ${mediaKeyBuffer.length}`
    );
  }

  return mediaKeyBuffer;
}

function deriveAudioKeys(mediaKey) {
  const expanded = Buffer.from(
    hkdfSync("sha256", mediaKey, HKDF_SALT, HKDF_INFO, HKDF_LENGTH)
  );

  return {
    iv: expanded.subarray(0, 16),
    cipherKey: expanded.subarray(16, 48),
    macKey: expanded.subarray(48, 80),
  };
}

function removePkcs7Padding(buffer) {
  if (buffer.length === 0) {
    throw new Error("Decrypted audio is empty");
  }

  const paddingLength = buffer[buffer.length - 1];
  if (paddingLength < 1 || paddingLength > 16 || paddingLength > buffer.length) {
    throw new Error("Invalid PKCS7 padding");
  }

  for (let i = buffer.length - paddingLength; i < buffer.length; i += 1) {
    if (buffer[i] !== paddingLength) {
      throw new Error("Invalid PKCS7 padding");
    }
  }

  return buffer.subarray(0, buffer.length - paddingLength);
}

function decryptAudioAttempt(encryptedFile, keys, headerLength) {
  if (encryptedFile.length <= headerLength + MAC_LENGTH) {
    throw new Error(
      `Encrypted payload too short for headerLength=${headerLength} and macLength=${MAC_LENGTH}`
    );
  }

  const payload = encryptedFile.subarray(headerLength);
  const ciphertext = payload.subarray(0, payload.length - MAC_LENGTH);
  const fileMac = payload.subarray(payload.length - MAC_LENGTH);

  if (ciphertext.length === 0) {
    throw new Error("Ciphertext is empty");
  }

  if (ciphertext.length % 16 !== 0) {
    throw new Error(
      `Ciphertext length ${ciphertext.length} is not aligned to AES-CBC block size`
    );
  }

  const computedMac = createHmac("sha256", keys.macKey)
    .update(keys.iv)
    .update(ciphertext)
    .digest()
    .subarray(0, MAC_LENGTH);

  if (!timingSafeEqual(fileMac, computedMac)) {
    throw new Error(`MAC validation failed for headerLength=${headerLength}`);
  }

  const decipher = createDecipheriv("aes-256-cbc", keys.cipherKey, keys.iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return removePkcs7Padding(decrypted);
}

function decryptWhatsAppAudio(encryptedFile, mediaKey) {
  const keys = deriveAudioKeys(mediaKey);
  const failures = [];

  for (const headerLength of HEADER_LENGTHS) {
    try {
      return decryptAudioAttempt(encryptedFile, keys, headerLength);
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : `Unknown error for headerLength=${headerLength}`
      );
    }
  }

  throw new TranscriptionError(
    422,
    "AUDIO_DECRYPT_FAILED",
    "Failed to decrypt WhatsApp audio with header lengths 0 and 10",
    failures.join(" | ")
  );
}

function downloadEncryptedMedia(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(
        new TranscriptionError(
          502,
          "MEDIA_DOWNLOAD_FAILED",
          "Too many redirects while downloading encrypted audio"
        )
      );
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      reject(new TranscriptionError(400, "INVALID_URL", "url must be a valid HTTPS URL"));
      return;
    }

    if (parsedUrl.protocol !== "https:") {
      reject(new TranscriptionError(400, "INVALID_URL", "Only HTTPS audio URLs are supported"));
      return;
    }

    const request = https.get(parsedUrl, (response) => {
      const { statusCode = 0, headers } = response;

      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
        response.resume();
        const nextUrl = new URL(headers.location, parsedUrl).toString();
        resolve(downloadEncryptedMedia(nextUrl, redirectCount + 1));
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(
          new TranscriptionError(
            502,
            "MEDIA_DOWNLOAD_FAILED",
            `Failed to download encrypted audio from WhatsApp CDN`,
            `status=${statusCode}`
          )
        );
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", (error) => {
        reject(
          new TranscriptionError(
            502,
            "MEDIA_DOWNLOAD_FAILED",
            "Error while reading encrypted audio stream",
            error instanceof Error ? error.message : String(error)
          )
        );
      });
    });

    request.on("error", (error) => {
      reject(
        new TranscriptionError(
          502,
          "MEDIA_DOWNLOAD_FAILED",
          "Failed to download encrypted audio",
          error instanceof Error ? error.message : String(error)
        )
      );
    });
  });
}

async function transcribeWithGroq(audioBuffer, groqApiKey) {
  if (!groqApiKey) {
    throw new TranscriptionError(
      500,
      "GROQ_NOT_CONFIGURED",
      "Missing GROQ_API_KEY environment variable"
    );
  }

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: "whatsapp-audio.ogg",
    contentType: "audio/ogg",
  });
  form.append("model", "whisper-large-v3");

  let response;
  try {
    response = await fetch(GROQ_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });
  } catch (error) {
    throw new TranscriptionError(
      502,
      "GROQ_REQUEST_FAILED",
      "Failed to call Groq transcription API",
      error instanceof Error ? error.message : String(error)
    );
  }

  let payload;
  const responseText = await response.text();

  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = { raw: responseText };
  }

  if (!response.ok) {
    throw new TranscriptionError(
      502,
      "GROQ_TRANSCRIPTION_FAILED",
      "Groq transcription request failed",
      payload?.error?.message || payload?.raw || `status=${response.status}`
    );
  }

  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) {
    throw new TranscriptionError(
      502,
      "EMPTY_TRANSCRIPTION",
      "Groq returned an empty transcription"
    );
  }

  return text;
}

export async function transcribeWhatsAppAudio({ url, mediaKey, groqApiKey, logger = console }) {
  if (!url || typeof url !== "string") {
    throw new TranscriptionError(400, "INVALID_BODY", "Missing required field: url");
  }

  if (mediaKey === undefined || mediaKey === null) {
    throw new TranscriptionError(400, "INVALID_BODY", "Missing required field: mediaKey");
  }

  const mediaKeyBuffer = normalizeMediaKey(mediaKey);
  const encryptedFile = await downloadEncryptedMedia(url);

  logger.info?.("whatsapp audio debug", {
    event: "whatsapp_audio_debug",
    encLen: encryptedFile.length,
    mediaKeyLen: mediaKeyBuffer.length,
  });

  const audioBuffer = decryptWhatsAppAudio(encryptedFile, mediaKeyBuffer);
  const text = await transcribeWithGroq(audioBuffer, groqApiKey);

  return {
    text,
    debug: {
      encLen: encryptedFile.length,
      mediaKeyLen: mediaKeyBuffer.length,
    },
  };
}
