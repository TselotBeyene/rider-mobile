import * as SecureStore from 'expo-secure-store';

const LOCAL_SERVICE_BASES: Array<[prefix: string, base: string]> = [
  ['/auth', 'http://127.0.0.1:4001/v1'],
  ['/verification', 'http://127.0.0.1:4002/v1'],
  ['/rides', 'http://127.0.0.1:4003/v1'],
  ['/location', 'http://127.0.0.1:4004/v1'],
  ['/matching', 'http://127.0.0.1:4005/v1'],
  ['/emergency', 'http://127.0.0.1:4006/v1']
];

/** Prefer per-service local ports in development; fall back to gateway/env. */
function apiBaseFor(path: string): string {
  const normalized = path.startsWith('/v1/') ? path.slice(3) : path;
  const match = LOCAL_SERVICE_BASES.find(([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  if (match) return match[1];
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8080/v1';
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8080/v1';
// Prefer the realtime service directly in local/dev — gateway WS proxy is easy to misconfigure.
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL?.includes(':8080')
  ? 'ws://127.0.0.1:4007/v1/socket'
  : (process.env.EXPO_PUBLIC_WS_URL ?? 'ws://127.0.0.1:4007/v1/socket');

const ACCESS_KEY = 'womenride.access_token';
const REFRESH_KEY = 'womenride.refresh_token';
const DEVICE_KEY = 'womenride.device_id';

export interface Session { accessToken: string; refreshToken: string; deviceId: string; }

let refreshInFlight: Promise<Session> | null = null;

export async function deviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  }
  return id;
}

export async function saveSession(accessToken: string, refreshToken: string): Promise<Session> {
  const id = await deviceId();
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken)
  ]);
  return { accessToken, refreshToken, deviceId: id };
}

export async function loadSession(): Promise<Session | null> {
  const [accessToken, refreshToken, id] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    deviceId()
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken, deviceId: id } : null;
}

export async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}

async function parseResponse(response: Response, url?: string) {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const message =
      (typeof body?.error === 'object' && body?.error?.message) ||
      (typeof body?.message === 'string' && body.message) ||
      `Request failed (${response.status})`;
    const err = new Error(url ? `${message} @ ${url}` : message) as Error & { code?: string; status?: number };
    err.code = typeof body?.error === 'object' ? body?.error?.code : undefined;
    err.status = response.status;
    throw err;
  }
  return body;
}

function normalizeApiPath(path: string): string {
  return path.startsWith('/v1/') ? path.slice(3) : path;
}

export async function api(path: string, options: RequestInit = {}, token?: string) {
  const normalized = normalizeApiPath(path);
  const headers = new Headers(options.headers ?? {});
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const url = `${apiBaseFor(normalized)}${normalized}`;
  const response = await fetch(url, { ...options, headers });
  return parseResponse(response, url);
}

export async function refreshSession(session?: Session | null): Promise<Session> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = session ?? (await loadSession());
    if (!current?.refreshToken) throw new Error('No refresh session available. Sign in again.');
    const response = await api('/auth/token/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refreshToken, device_id: current.deviceId })
    });
    return saveSession(response.access_token, response.refresh_token);
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/** Authenticated API helper that always reads the latest token from SecureStore on 401. */
export async function apiWithSession(
  path: string,
  options: RequestInit = {},
  onSession?: (s: Session) => void
): Promise<any> {
  let active = await loadSession();
  if (!active) throw new Error('No active session');
  try {
    return await api(path, options, active.accessToken);
  } catch (error: any) {
    if (error?.status !== 401) throw error;
    active = await refreshSession(active);
    onSession?.(active);
    return api(path, options, active.accessToken);
  }
}
