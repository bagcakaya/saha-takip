/**
 * Password Security Service (Salted SHA-256 with Zero-Downtime Lazy Migration)
 * 
 * Standards:
 * - Prefix: $s256$<salt>$<hash>
 * - Salt: 16 bytes (32 hex characters)
 * - Hash: Standard FIPS 180-4 SHA-256 of `${salt}:${password}`
 * - Fully compatible across Web, React Native, Node.js and Cloud environments
 */

const HASH_PREFIX = '$s256$';

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Standard FIPS 180-4 SHA-256 implementation
 */
export function sha256Sync(ascii: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // Convert input to UTF-8
  const utf8 = unescape(encodeURIComponent(ascii));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const bitLength = utf8.length * 8;
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  for (let i = 0; i < words.length; i += 16) {
    const W = new Array(64);
    for (let t = 0; t < 16; t++) {
      W[t] = words[i + t] | 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Generates a random cryptographic salt (32 hex characters)
 */
function generateRandomSalt(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallback
  }

  let salt = '';
  for (let i = 0; i < 32; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

/**
 * Constant-time string equality check to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const PasswordSecurity = {
  /**
   * Hashes a raw password with a unique cryptographic salt.
   * Returns: `$s256$<salt>$<hash>`
   */
  async hashPassword(password: string): Promise<string> {
    const cleanPass = (password || '').trim();
    const salt = generateRandomSalt();
    const hash = sha256Sync(`${salt}:${cleanPass}`);
    return `${HASH_PREFIX}${salt}$${hash}`;
  },

  /**
   * Checks whether a stored password string is already in salted SHA-256 format.
   */
  isHashed(storedPassword?: string | null): boolean {
    if (!storedPassword) return false;
    return storedPassword.startsWith(HASH_PREFIX);
  },

  /**
   * Verifies an entered password against stored password.
   * Supports both new `$s256$...` salted hashes and legacy plaintext passwords.
   * 
   * Returns:
   * - `valid`: true if password matches
   * - `needsRehash`: true if password was verified as legacy plaintext, meaning caller should update storage to salted hash
   */
  async verifyPassword(
    enteredPassword: string,
    storedPassword?: string | null
  ): Promise<{ valid: boolean; needsRehash: boolean }> {
    if (!storedPassword) {
      return { valid: false, needsRehash: false };
    }

    const cleanEntered = (enteredPassword || '').trim();

    // 1. New Salted SHA-256 Format
    if (this.isHashed(storedPassword)) {
      const parts = storedPassword.split('$');
      // Format: '' , 's256' , salt , hash
      if (parts.length === 4 && parts[1] === 's256') {
        const salt = parts[2];
        const expectedHash = parts[3];
        const computedHash = sha256Sync(`${salt}:${cleanEntered}`);
        const isValid = timingSafeEqual(computedHash.toLowerCase(), expectedHash.toLowerCase());
        return { valid: isValid, needsRehash: false };
      }
    }

    // 2. Legacy Plaintext Format (Backward compatibility)
    const isLegacyMatch = timingSafeEqual(cleanEntered, storedPassword.trim());
    return {
      valid: isLegacyMatch,
      needsRehash: isLegacyMatch, // If it matches legacy plaintext, signal that it needs immediate rehash
    };
  },
};
