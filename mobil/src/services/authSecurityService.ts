import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile Auth Security Service (Anti-Brute Force & Rate Limiting)
 * 
 * Provides protection against automated password-guessing attacks:
 * - Locks account for 5 minutes after 5 consecutive failed login attempts.
 * - Displays remaining lockout time (minutes & seconds).
 * - Applies 1000ms artificial delay on failed attempts to throttle automated scripts.
 * - Resets attempt counter immediately on successful login.
 */

const THROTTLE_STORAGE_KEY = '@saha_takip_auth_throttle';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface ThrottleRecord {
  attempts: number;
  lockUntil: number; // timestamp ms
  lastAttempt: number;
}

interface ThrottleMap {
  [key: string]: ThrottleRecord;
}

let memoryMap: ThrottleMap = {};
let isInitialized = false;

function getAccountKey(companyCode: string, username: string): string {
  const cleanComp = (companyCode || 'POLATLAR').trim().toUpperCase();
  const cleanUser = (username || '').trim().toLowerCase();
  return `${cleanComp}:${cleanUser}`;
}

async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  try {
    const raw = await AsyncStorage.getItem(THROTTLE_STORAGE_KEY);
    if (raw) {
      memoryMap = JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  isInitialized = true;
}

async function persistMap(): Promise<void> {
  try {
    await AsyncStorage.setItem(THROTTLE_STORAGE_KEY, JSON.stringify(memoryMap));
  } catch {
    // ignore
  }
}

export const MobileAuthSecurityService = {
  MAX_ATTEMPTS: MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES: 5,

  /**
   * Checks if an account is currently locked out
   */
  async checkLockout(companyCode: string, username: string): Promise<{
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
  }> {
    await ensureInitialized();
    const key = getAccountKey(companyCode, username);
    const record = memoryMap[key];
    const now = Date.now();

    if (!record) {
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
    }

    if (record.lockUntil > 0) {
      if (now < record.lockUntil) {
        const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
        return { isLocked: true, remainingSeconds, attemptsLeft: 0 };
      } else {
        delete memoryMap[key];
        await persistMap();
        return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
      }
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
    return { isLocked: false, remainingSeconds: 0, attemptsLeft };
  },

  /**
   * Records a failed login attempt. If attempts reach limit, locks account for 5 minutes.
   */
  async recordFailedAttempt(companyCode: string, username: string): Promise<{
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
  }> {
    await ensureInitialized();
    const key = getAccountKey(companyCode, username);
    const now = Date.now();
    const record = memoryMap[key] || { attempts: 0, lockUntil: 0, lastAttempt: 0 };

    record.attempts += 1;
    record.lastAttempt = now;

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockUntil = now + LOCKOUT_DURATION_MS;
      memoryMap[key] = record;
      await persistMap();
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attemptsLeft: 0,
      };
    }

    memoryMap[key] = record;
    await persistMap();

    const attemptsLeft = MAX_FAILED_ATTEMPTS - record.attempts;
    return { isLocked: false, remainingSeconds: 0, attemptsLeft };
  },

  /**
   * Clears failed attempts immediately upon successful login
   */
  async resetAttempts(companyCode: string, username: string): Promise<void> {
    await ensureInitialized();
    const key = getAccountKey(companyCode, username);
    if (memoryMap[key]) {
      delete memoryMap[key];
      await persistMap();
    }
  },

  /**
   * Generates a user-friendly lockout message with remaining time
   */
  formatLockoutMessage(remainingSeconds: number): string {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeStr = mins > 0 ? `${mins} dk ${secs} sn` : `${secs} saniye`;
    return `Çok fazla hatalı şifre denemesi yapıldı. Güvenliğiniz için hesabınız 5 dakika kilitlendi. Kalan süre: ${timeStr}.`;
  },

  /**
   * Generates error message showing remaining attempts
   */
  formatFailedMessage(companyCode: string, attemptsLeft: number): string {
    const cleanComp = (companyCode || 'POLATLAR').trim().toUpperCase();
    if (attemptsLeft > 0) {
      return `"${cleanComp}" kurumu için kullanıcı adı veya şifre hatalı. (Kalan deneme hakkı: ${attemptsLeft})`;
    }
    return `"${cleanComp}" kurumu için kullanıcı adı veya şifre hatalı.`;
  },

  /**
   * Adds an artificial delay (1000ms) to throttle brute-force bots
   */
  async delay(ms: number = 1000): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
