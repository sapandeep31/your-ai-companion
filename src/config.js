/**
 * Application Configuration
 * Reads from Vite environment variables with localhost defaults.
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? 'https://youraicompanionbackend2-d2bku3kh.b4a.run' : 'http://localhost:8000')
).replace(/\/$/, '');

export const WS_BASE_URL = (
  import.meta.env.VITE_WS_BASE_URL || 
  API_BASE_URL.replace(/^http/, 'ws')
).replace(/\/$/, '');
