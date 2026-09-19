/**
 * Mobile Input Sanitization & XSS / Injection Protection Service
 * 
 * Provides defense-in-depth against Cross-Site Scripting (XSS),
 * HTML tag injection, javascript: pseudo-protocols, and malicious payloads.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const DANGEROUS_PATTERNS: RegExp[] = [
  /<\s*script\b[^>]*>/i,
  /<\s*\/\s*script\s*>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=\s*["'][^"']*["']/i,
  /<\s*iframe\b[^>]*>/i,
  /<\s*object\b[^>]*>/i,
  /<\s*embed\b[^>]*>/i,
  /<\s*svg\b[^>]*onload/i,
];

export const MobileSanitizeService = {
  /**
   * Strips all HTML tags and dangerous protocols from a string.
   */
  stripHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '');
  },

  /**
   * Escapes dangerous HTML characters.
   */
  escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
  },

  /**
   * Sanitizes general free-text input (task titles, notes, descriptions, names).
   */
  sanitizeText(input: string, maxLength: number = 2000): string {
    if (!input || typeof input !== 'string') return '';
    const cleaned = this.stripHtml(input)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
    return cleaned.slice(0, maxLength);
  },

  /**
   * Sanitizes identifier strings (company codes, usernames, IDs).
   */
  sanitizeIdentifier(input: string, maxLength: number = 50): string {
    if (!input || typeof input !== 'string') return '';
    const cleaned = input
      .trim()
      .replace(/[^\w\.\-\u00C0-\u017F]/g, '');
    return cleaned.slice(0, maxLength);
  },

  /**
   * Sanitizes and validates an email address.
   */
  sanitizeEmail(input: string, maxLength: number = 100): string {
    if (!input || typeof input !== 'string') return '';
    const cleaned = input.trim().toLowerCase().slice(0, maxLength);
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return emailRegex.test(cleaned) ? cleaned : '';
  },

  /**
   * Checks whether the input string contains obvious XSS / injection attack payloads.
   */
  detectMaliciousContent(input: string): { isMalicious: boolean; reason?: string } {
    if (!input || typeof input !== 'string') return { isMalicious: false };

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isMalicious: true,
          reason: `Zararlı kod veya script enjeksiyon deseni tespit edildi: ${pattern.source}`,
        };
      }
    }

    return { isMalicious: false };
  },
};
