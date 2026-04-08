// Security utilities für Lagerverwaltung System

/**
 * Input Sanitization für XSS-Schutz
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Entfernt HTML-Tags
    .replace(/javascript:/gi, '') // Entfernt JavaScript-URLs
    .replace(/on\w+=/gi, '') // Entfernt Event-Handler
    .trim();
};

/**
 * Auth-Token Validation
 */
export const validateAuthToken = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;

  // JWT Format prüfen (Header.Payload.Signature)
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    JSON.parse(atob(parts[1]));
    return true;
  } catch {
    return false;
  }
};

/**
 * Secure Token Manager – Access Token wird ausschließlich im Arbeitsspeicher gehalten.
 * Kein localStorage-Schreiben → kein XSS-lesbarer Klartext-Token.
 * Die Session-Persistenz (Reload nach Offline-Nutzung) übernimmt der Zustand-Store.
 */
export class SecureTokenManager {
  // In-Memory-Speicher – nicht persistiert, nicht per XSS auslesbar
  private static _token: string | null = null;
  private static _tokenExpiry: number | null = null;

  static setToken(token: string, expiryHours: number = 24): void {
    if (!validateAuthToken(token)) {
      throw new Error('Invalid token format');
    }
    this._token = token;
    this._tokenExpiry = Date.now() + expiryHours * 60 * 60 * 1000;

    // Alte localStorage-Einträge aus früheren Versionen aufräumen
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_expiry');
    } catch {
      // Ignorieren
    }
  }

  static getToken(): string | null {
    if (!this._token || !this._tokenExpiry) return null;
    if (Date.now() > this._tokenExpiry) {
      this.clearToken();
      return null;
    }
    return validateAuthToken(this._token) ? this._token : null;
  }

  static clearToken(): void {
    this._token = null;
    this._tokenExpiry = null;
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_expiry');
    } catch {
      // Ignorieren
    }
  }

  // Refresh-Token wird als HttpOnly-Cookie vom Backend verwaltet –
  // diese Methoden bleiben als No-Op erhalten, damit bestehende Aufrufer nicht brechen.
  static setRefreshToken(_token: string, _expiryHours?: number): void {
    // Intentionally empty: Refresh-Token wird serverseitig als HttpOnly-Cookie gesetzt
  }

  static getRefreshToken(): string | null {
    return null; // Kommt ausschließlich aus dem HttpOnly-Cookie (nicht JS-lesbar)
  }

  static clearRefreshToken(): void {
    try {
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('refresh_expiry');
    } catch {
      // Ignorieren
    }
  }

  static isTokenExpired(): boolean {
    if (!this._tokenExpiry) return true;
    return Date.now() > this._tokenExpiry;
  }
}

/**
 * Logging für Security-Events (Frontend-seitig, nur in Development)
 */
export class SecurityLogger {
  private static logs: Array<{timestamp: number, event: string, details: unknown}> = [];

  static logSecurityEvent(event: string, details: unknown = {}): void {
    const logEntry = {
      timestamp: Date.now(),
      event,
      details,
    };

    this.logs.push(logEntry);

    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  static getSecurityLogs(): Array<{timestamp: number, event: string, details: unknown}> {
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Password Strength Validator
 */
export const validatePasswordStrength = (password: string) => {
  const requirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metRequirements = Object.values(requirements).filter(Boolean).length;
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (metRequirements >= 5) strength = 'strong';
  else if (metRequirements >= 3) strength = 'medium';

  return {
    isValid: strength === 'strong',
    strength,
    score: metRequirements * 20,
    requirements,
  };
};
