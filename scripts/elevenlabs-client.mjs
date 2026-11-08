import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

let cachedClient = null;

export function getElevenLabsClient(apiKey = process.env.ELEVENLABS_API_KEY) {
  if (!apiKey) return null;
  if (!cachedClient || cachedClient._apiKey !== apiKey) {
    cachedClient = new ElevenLabsClient({ apiKey });
    cachedClient._apiKey = apiKey;
  }
  return cachedClient;
}

export async function synthesizeWithElevenLabs(text, {
  voiceId = 'EXAVITQu4vr4xnSDxMaL', // Sarah (natural warm female voice)
  modelId = 'eleven_v4',
  apiKey = process.env.ELEVENLABS_API_KEY,
  client = getElevenLabsClient(apiKey),
} = {}) {
  if (!client) return null;
  try {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: 'mp3_44100_128',
    });
    const audioBuffer = await buffer(Readable.fromWeb(audioStream));
    if (audioBuffer?.length) {
      return {
        buffer: audioBuffer,
        mimeType: 'audio/mpeg',
        fileName: 'salma_elevenlabs.mp3',
      };
    }
  } catch (err) {
    console.error('ElevenLabs synthesis error:', err?.message || err);
  }
  return null;
}
