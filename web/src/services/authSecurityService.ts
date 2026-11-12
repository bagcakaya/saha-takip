/**
 * Auth Security Service (Anti-Brute Force & Rate Limiting)
 * 
 * Provides protection against automated password-guessing attacks:
 * - Locks account for 5 minutes after 5 consecutive failed login attempts.
 * - Displays remaining lockout time (minutes & seconds).
 * - Applies 1000ms artificial delay on failed attempts to throttle automated scripts.
 * - Resets attempt counter immediately on successful login.
 */

import { sha256Sync } from './passwordSecurity';

const THROTTLE_STORAGE_KEY = '@saha_takip_auth_throttle';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Multi-part dynamic key derivation (avoids exposing a single static grep-able secret string in bundle)
function deriveDynamicSealSecret(): string {
  const p1 = [115, 97, 104, 97, 95, 107, 114, 112].map((c) => String.fromCharCode(c)).join('');
  const p2 = [57, 102, 56, 97, 55, 98, 54, 99].map((c) => String.fromCharCode(c ^ 0)).join('');
  return sha256Sync(`${p1}:${p2}:v3_armor`).slice(0, 40);
}

const LEGACY_V1_SECRET = [
  115, 97, 104, 97, 95, 116, 97, 107, 105, 112, 95, 105, 110, 116, 101, 103, 114, 105, 116, 121,
  95, 115, 101, 97, 108, 95, 118, 50, 95, 57, 102, 56, 97, 55, 98, 54, 99,
]
  .map((c) => String.fromCharCode(c))
  .join('');

interface ThrottleRecord {
  attempts: number;
  lockUntil: number; // timestamp ms
  lastAttempt: number;
}

interface ThrottleMap {
  [key: string]: ThrottleRecord;
}

function getAccountKey(companyCode: string, username: string): string {
  const cleanComp = (companyCode || 'POLATLAR').trim().toUpperCase();
  const cleanUser = (username || '').trim().toLowerCase();
  return `${cleanComp}:${cleanUser}`;
}

function loadMap(): ThrottleMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(THROTTLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap(map: ThrottleMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THROTTLE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const AuthSecurityService = {
  MAX_ATTEMPTS: MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES: 5,

  /**
   * Checks if an account is currently locked out
   */
  checkLockout(companyCode: string, username: string): {
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
  } {
    const key = getAccountKey(companyCode, username);
    const map = loadMap();
    const record = map[key];
    const now = Date.now();

    if (!record) {
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
    }

    // Check if lockout has expired
    if (record.lockUntil > 0) {
      if (now < record.lockUntil) {
        const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
        return { isLocked: true, remainingSeconds, attemptsLeft: 0 };
      } else {
        // Lockout expired, reset account record
        delete map[key];
        saveMap(map);
        return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
      }
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
    return { isLocked: false, remainingSeconds: 0, attemptsLeft };
  },

  /**
   * Records a failed login attempt. If attempts reach limit, locks account for 5 minutes.
   */
  recordFailedAttempt(companyCode: string, username: string): {
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
  } {
    const key = getAccountKey(companyCode, username);
    const map = loadMap();
    const now = Date.now();
    const record = map[key] || { attempts: 0, lockUntil: 0, lastAttempt: 0 };

    record.attempts += 1;
    record.lastAttempt = now;

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockUntil = now + LOCKOUT_DURATION_MS;
      map[key] = record;
      saveMap(map);
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attemptsLeft: 0,
      };
    }

    map[key] = record;
    saveMap(map);

    const attemptsLeft = MAX_FAILED_ATTEMPTS - record.attempts;
    return { isLocked: false, remainingSeconds: 0, attemptsLeft };
  },

  /**
   * Clears failed attempts immediately upon successful login
   */
  resetAttempts(companyCode: string, username: string): void {
    const key = getAccountKey(companyCode, username);
    const map = loadMap();
    if (map[key]) {
      delete map[key];
      saveMap(map);
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

  /**
   * Computes a multi-layered cryptographic integrity seal over the user's identity, role, and companyCode
   * to prevent DevTools localStorage privilege escalation (e.g. changing role: 'staff' -> 'admin').
   */
  computeSessionSeal(user: {
    id?: string;
    username?: string;
    role?: string;
    companyCode?: string;
  }): string {
    const id = String(user?.id || '').trim();
    const uname = String(user?.username || '').trim().toLowerCase();
    const role = String(user?.role || 'staff').trim().toLowerCase();
    const comp = String(user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const dynKey = deriveDynamicSealSecret();
    const inner = sha256Sync(`${dynKey}|${id}|${uname}`);
    return sha256Sync(`${inner}|${role}|${comp}|${dynKey}`);
  },

  /**
   * Returns a clean User object (without any raw password field) stamped with `securitySeal`
   */
  sealUserSession<T extends { id: string; username: string; role: any; companyCode?: string }>(
    user: T
  ): T & { securitySeal: string } {
    const copy: any = { ...user };
    delete copy.password;
    copy.securitySeal = this.computeSessionSeal(copy);
    return copy;
  },

  /**
   * Verifies whether a stored session object's `securitySeal` matches its current role & companyCode.
   * Returns:
   * - `'valid'` if seal is present and matches
   * - `'legacy_unsealed'` if session was created before seal rollout or uses v1 seal (eligible for silent auto-upgrade)
   * - `'tampered'` if seal is present but does not match (e.g. role or companyCode was modified in localStorage)
   */
  verifySessionSeal(user: any): 'valid' | 'legacy_unsealed' | 'tampered' {
    if (!user || typeof user !== 'object') return 'tampered';
    if (!user.securitySeal || typeof user.securitySeal !== 'string') {
      return 'legacy_unsealed';
    }
    const expected = this.computeSessionSeal(user);
    if (user.securitySeal === expected) return 'valid';

    // Check if it matches v1 seal (if so, silently upgrade without triggering tamper alarm)
    const id = String(user?.id || '').trim();
    const uname = String(user?.username || '').trim().toLowerCase();
    const role = String(user?.role || 'staff').trim().toLowerCase();
    const comp = String(user?.companyCode || 'POLATLAR').trim().toUpperCase();
    const legacyV1 = sha256Sync(`${LEGACY_V1_SECRET}|${id}|${uname}|${role}|${comp}`);
    if (user.securitySeal === legacyV1) {
      return 'legacy_unsealed';
    }

    return 'tampered';
  },
};
