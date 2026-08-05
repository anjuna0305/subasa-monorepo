import { API_BASE_URL, ASR_TRANSCRIBE_URL, RequestTimeouts, TTS_VOICE } from '@/lib/config';

export type Chatbot = {
  uuid: string;
  chatbot_name: string;
  description: string;
  hero_image: string;
  url_path: string;
  is_publish: boolean;
  is_public: boolean;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The gateway returns `detail` as either a string or a list of `{field, message}`. */
function readErrorDetail(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => (typeof entry === 'object' && entry ? (entry as any).message : null))
      .filter(Boolean);
    if (messages.length) return messages.join(', ');
  }
  return fallback;
}

async function request<T>(url: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = RequestTimeouts.default, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...rest, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('The request timed out.', 408);
    throw new ApiError(`Could not reach the server at ${url}.`, 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      readErrorDetail(body, `Request failed with status ${response.status}.`),
      response.status
    );
  }

  return body as T;
}

/**
 * The gateway builds absolute media URLs from `PUBLIC_BASE_URL` or the request's Host
 * header. A loopback host resolves to the phone itself, so re-anchor those on the API base.
 */
function reanchorMediaUrl(url: string): string {
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  const match = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(url);
  if (!match) return url;
  const [, host, path = ''] = match;
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return `${API_BASE_URL}${path}`;
  }
  return url;
}

export async function getChatbotByUrlPath(urlPath: string): Promise<Chatbot> {
  return request<Chatbot>(
    `${API_BASE_URL}/custom-chatbots/by-url-path/${encodeURIComponent(urlPath)}`,
    { method: 'GET' }
  );
}

export function heroImageUrl(chatbot: Chatbot): string | null {
  if (!chatbot.hero_image) return null;
  if (/^https?:\/\//i.test(chatbot.hero_image)) return reanchorMediaUrl(chatbot.hero_image);
  const name = chatbot.hero_image.split('/').pop();
  if (!name) return null;
  return `${API_BASE_URL}/custom-chatbots/images/${encodeURIComponent(name)}`;
}

function mimeTypeFor(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  if (extension === 'wav') return 'audio/wav';
  if (extension === '3gp') return 'audio/3gpp';
  return 'audio/mp4';
}

export async function transcribe(fileUri: string): Promise<string> {
  const name = fileUri.split('/').pop() || 'utterance.m4a';
  const form = new FormData();
  // React Native's FormData takes this shape for file parts rather than a Blob.
  form.append('file', { uri: fileUri, name, type: mimeTypeFor(fileUri) } as unknown as Blob);

  const body = await request<{ transcription?: string }>(ASR_TRANSCRIBE_URL, {
    method: 'POST',
    // Content-Type is left unset so the runtime adds the multipart boundary.
    body: form,
    timeoutMs: RequestTimeouts.transcribe,
  });

  return (body.transcription ?? '').trim();
}

export async function sendMessage(urlPath: string, message: string): Promise<string> {
  const body = await request<{ response?: string }>(
    `${API_BASE_URL}/custom-chatbots/api/${encodeURIComponent(urlPath)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      timeoutMs: RequestTimeouts.chat,
    }
  );

  return (body.response ?? '').trim();
}

export async function generateTts(text: string): Promise<string> {
  const body = await request<{ audioUrl?: string }>(`${API_BASE_URL}/tts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...TTS_VOICE, text }),
    timeoutMs: RequestTimeouts.tts,
  });

  if (!body.audioUrl) throw new ApiError('The speech service returned no audio.', 502);
  return reanchorMediaUrl(body.audioUrl);
}
