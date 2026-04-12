import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "saiyonix.session";
const TOKENS_KEY = "saiyonix.tokens";

async function safeGetItem(key: string) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null && value !== undefined) return value;
  } catch {
    // ignore
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return;
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

async function safeRemoveItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export type StoredSession = {
  user: unknown;
  role?: string | null;
};

export type StoredTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

export async function loadSession() {
  const raw = await safeGetItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(data: StoredSession) {
  await safeSetItem(SESSION_KEY, JSON.stringify(data));
}

export async function clearSession() {
  await safeRemoveItem(SESSION_KEY);
}

export async function loadTokens() {
  const raw = await safeGetItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(data: StoredTokens) {
  await safeSetItem(TOKENS_KEY, JSON.stringify(data));
}

export async function clearTokens() {
  await safeRemoveItem(TOKENS_KEY);
}
