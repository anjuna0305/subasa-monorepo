"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.getChatbotByUrlPath = getChatbotByUrlPath;
exports.heroImageUrl = heroImageUrl;
exports.transcribe = transcribe;
exports.sendMessage = sendMessage;
exports.generateTts = generateTts;
exports.prepareTtsStream = prepareTtsStream;
exports.synthesize = synthesize;
const config_1 = require("@/lib/config");
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
exports.ApiError = ApiError;
/** The gateway returns `detail` as either a string or a list of `{field, message}`. */
function readErrorDetail(body, fallback) {
    if (typeof body !== 'object' || body === null)
        return fallback;
    const detail = body.detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        const messages = detail
            .map((entry) => (typeof entry === 'object' && entry ? entry.message : null))
            .filter(Boolean);
        if (messages.length)
            return messages.join(', ');
    }
    return fallback;
}
async function request(url, init) {
    const { timeoutMs = config_1.RequestTimeouts.default, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(url, { ...rest, signal: controller.signal });
    }
    catch (error) {
        if (controller.signal.aborted)
            throw new ApiError('The request timed out.', 408);
        throw new ApiError(`Could not reach the server at ${url}.`, 0);
    }
    finally {
        clearTimeout(timer);
    }
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch {
            body = null;
        }
    }
    if (!response.ok) {
        throw new ApiError(readErrorDetail(body, `Request failed with status ${response.status}.`), response.status);
    }
    return body;
}
/** Host (with port) the API base points at, e.g. `subasa.lk` or `192.168.1.10:7010`. */
const API_BASE_HOST = (/^https?:\/\/([^/]+)/i.exec(config_1.API_BASE_URL)?.[1] ?? '').toLowerCase();
/** Path the gateway is served under, e.g. `/voc-si/api/api-gateway`. Empty at the root. */
const API_BASE_PATH = config_1.API_BASE_URL.replace(/^https?:\/\/[^/]+/i, '');
function isUnderBasePath(path) {
    return !API_BASE_PATH || path === API_BASE_PATH || path.startsWith(`${API_BASE_PATH}/`);
}
/** Drops the gateway's own prefix so re-anchoring can't end up doubling it. */
function stripBasePath(path) {
    if (!API_BASE_PATH || !isUnderBasePath(path))
        return path;
    return path.slice(API_BASE_PATH.length);
}
/**
 * The gateway builds absolute media URLs from `PUBLIC_BASE_URL` or the request's Host
 * header, which leaves two ways for the URL to come back unreachable from a phone: a
 * loopback host resolves to the phone itself, and a Host header carries no path, so a
 * gateway deployed under a prefix hands back URLs that are missing it. Re-anchoring the
 * path onto `API_BASE_URL` fixes both. Foreign hosts are left alone — only a URL already
 * pointing at the gateway's own host can be one of ours that lost its prefix.
 */
function reanchorMediaUrl(url) {
    if (url.startsWith('/'))
        return `${config_1.API_BASE_URL}${stripBasePath(url)}`;
    const match = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(url);
    if (!match)
        return url;
    const [, host, path = ''] = match;
    const hostname = host.split(':')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        return `${config_1.API_BASE_URL}${stripBasePath(path)}`;
    }
    if (host.toLowerCase() === API_BASE_HOST && !isUnderBasePath(path)) {
        return `${config_1.API_BASE_URL}${path}`;
    }
    return url;
}
async function getChatbotByUrlPath(urlPath) {
    return request(`${config_1.API_BASE_URL}/custom-chatbots/by-url-path/${encodeURIComponent(urlPath)}`, { method: 'GET' });
}
function heroImageUrl(chatbot) {
    if (!chatbot.hero_image)
        return null;
    if (/^https?:\/\//i.test(chatbot.hero_image))
        return reanchorMediaUrl(chatbot.hero_image);
    const name = chatbot.hero_image.split('/').pop();
    if (!name)
        return null;
    return `${config_1.API_BASE_URL}/custom-chatbots/images/${encodeURIComponent(name)}`;
}
function mimeTypeFor(uri) {
    const extension = uri.split('.').pop()?.toLowerCase();
    if (extension === 'wav')
        return 'audio/wav';
    if (extension === '3gp')
        return 'audio/3gpp';
    return 'audio/mp4';
}
async function transcribe(fileUri) {
    const name = fileUri.split('/').pop() || 'utterance.m4a';
    const form = new FormData();
    // React Native's FormData takes this shape for file parts rather than a Blob.
    form.append('file', { uri: fileUri, name, type: mimeTypeFor(fileUri) });
    const body = await request(config_1.ASR_TRANSCRIBE_URL, {
        method: 'POST',
        // Content-Type is left unset so the runtime adds the multipart boundary.
        body: form,
        timeoutMs: config_1.RequestTimeouts.transcribe,
    });
    return (body.transcription ?? '').trim();
}
async function sendMessage(urlPath, message) {
    const body = await request(`${config_1.API_BASE_URL}/custom-chatbots/api/${encodeURIComponent(urlPath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        timeoutMs: config_1.RequestTimeouts.chat,
    });
    return (body.response ?? '').trim();
}
/** Waits for the whole reply to synthesize, then returns a URL to the finished file. */
async function generateTts(text) {
    const body = await request(`${config_1.API_BASE_URL}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config_1.TTS_VOICE, text }),
        timeoutMs: config_1.RequestTimeouts.tts,
    });
    if (!body.audioUrl)
        throw new ApiError('The speech service returned no audio.', 502);
    return reanchorMediaUrl(body.audioUrl);
}
/**
 * Returns immediately with a URL that streams the audio as it is synthesized, so playback
 * starts after the first sentence rather than after the whole reply.
 */
async function prepareTtsStream(text) {
    const body = await request(`${config_1.API_BASE_URL}/tts/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config_1.TTS_VOICE, text }),
    });
    if (!body.streamUrl)
        throw new ApiError('The speech service returned no audio.', 502);
    return reanchorMediaUrl(body.streamUrl);
}
async function synthesize(text) {
    return config_1.TTS_STREAMING ? prepareTtsStream(text) : generateTts(text);
}
