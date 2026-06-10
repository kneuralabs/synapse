// Production: set API_PROXY to your backend endpoint that holds the Anthropic
// API key server-side (e.g. a Cloudflare Worker or Supabase edge function).
// Shipping a key in client-side code exposes it to anyone who opens DevTools.
export const API_PROXY = '';
export const MODEL = 'claude-sonnet-4-6';
