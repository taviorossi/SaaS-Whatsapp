export const WHATSAPP_QUEUE_NAME = 'messages';
export const WHATSAPP_DLQ_NAME = 'messages-dlq';
export const WHATSAPP_API_VERSION = 'v21.0';
export const WHATSAPP_BASE_URL = 'https://graph.facebook.com';
export const WHATSAPP_DEDUP_TTL_SECONDS = 86400; // 24h
export const WHATSAPP_DEDUP_KEY_PREFIX = 'wa:dedup:';

/** Retry policy (conforme ADR-004) */
export const WHATSAPP_JOB_ATTEMPTS = 3;
export const WHATSAPP_JOB_BACKOFF_DELAYS = [1000, 5000, 25000]; // ms
