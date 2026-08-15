import * as SecureStore from 'expo-secure-store';
import { defaultOnboarding, type OnboardingDraft } from './types';

const ONBOARD_KEY = 'womenride.driver.onboarding.v1';
const NOTIF_KEY = 'womenride.driver.notifications.v1';
const WALLET_KEY = 'womenride.driver.wallet.v1';

export type LocalNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  kind: 'ride' | 'earnings' | 'document' | 'support' | 'safety' | 'system';
};

export type WalletState = {
  available_minor: number;
  pending_minor: number;
  currency: string;
  payouts: Array<{ id: string; amount_minor: number; method: string; status: string; created_at: string }>;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  return readJson(ONBOARD_KEY, defaultOnboarding());
}

export async function saveOnboardingDraft(draft: OnboardingDraft) {
  await writeJson(ONBOARD_KEY, draft);
}

export async function loadNotifications(): Promise<LocalNotification[]> {
  return readJson(NOTIF_KEY, [
    {
      id: 'n1',
      title: 'Welcome to WomenRide Driver',
      body: 'Complete documents and go online near demand zones to receive requests.',
      created_at: new Date().toISOString(),
      read: false,
      kind: 'system'
    },
    {
      id: 'n2',
      title: 'Document tip',
      body: 'Keep insurance and inspection dates up to date to avoid suspension.',
      created_at: new Date(Date.now() - 3600_000).toISOString(),
      read: false,
      kind: 'document'
    }
  ]);
}

export async function saveNotifications(items: LocalNotification[]) {
  await writeJson(NOTIF_KEY, items);
}

export async function pushNotification(partial: Omit<LocalNotification, 'id' | 'created_at' | 'read'>) {
  const items = await loadNotifications();
  const next: LocalNotification = {
    ...partial,
    id: `n_${Date.now()}`,
    created_at: new Date().toISOString(),
    read: false
  };
  await saveNotifications([next, ...items].slice(0, 50));
  return next;
}

export async function loadWallet(): Promise<WalletState> {
  return readJson(WALLET_KEY, {
    available_minor: 0,
    pending_minor: 0,
    currency: 'ETB',
    payouts: []
  });
}

export async function saveWallet(wallet: WalletState) {
  await writeJson(WALLET_KEY, wallet);
}
