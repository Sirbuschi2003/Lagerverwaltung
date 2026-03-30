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
 * Secure Token Storage mit Expiration
 */
export class SecureTokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly EXPIRY_KEY = 'auth_expiry';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly REFRESH_EXPIRY_KEY = 'refresh_expiry';

  static setToken(token: string, expiryHours: number = 24): void {
    if (!validateAuthToken(token)) {
      throw new Error('Invalid token format');
    }
    const expiry = Date.now() + (expiryHours * 60 * 60 * 1000);
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.EXPIRY_KEY, expiry.toString());
    } catch {
      // localStorage nicht verfügbar (z.B. Private-Mode)
    }
  }

  static getToken(): string | null {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const expiry = localStorage.getItem(this.EXPIRY_KEY);
      if (!token || !expiry) return null;
      if (Date.now() > parseInt(expiry)) {
        this.clearToken();
        return null;
      }
      return validateAuthToken(token) ? token : null;
    } catch {
      return null;
    }
  }

  static clearToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.EXPIRY_KEY);
    } catch {
      // Ignorieren
    }
  }

  static setRefreshToken(token: string, expiryHours: number = 24 * 30): void {
    if (!validateAuthToken(token)) {
      throw new Error('Invalid refresh token format');
    }
    const expiry = Date.now() + expiryHours * 60 * 60 * 1000;
    try {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
      localStorage.setItem(this.REFRESH_EXPIRY_KEY, expiry.toString());
    } catch {
      // Ignorieren
    }
  }

  static getRefreshToken(): string | null {
    try {
      const token = localStorage.getItem(this.REFRESH_TOKEN_KEY);
      const expiry = localStorage.getItem(this.REFRESH_EXPIRY_KEY);
      if (!token || !expiry) return null;
      if (Date.now() > parseInt(expiry)) {
        this.clearRefreshToken();
        return null;
      }
      return validateAuthToken(token) ? token : null;
    } catch {
      return null;
    }
  }

  static clearRefreshToken(): void {
    try {
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_EXPIRY_KEY);
    } catch {
      // Ignorieren
    }
  }

  static isTokenExpired(): boolean {
    try {
      const expiry = localStorage.getItem(this.EXPIRY_KEY);
      return !expiry || Date.now() > parseInt(expiry);
    } catch {
      return true;
    }
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
