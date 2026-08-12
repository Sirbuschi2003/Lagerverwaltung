/**
 * Offline Authentication Manager
 * Ermoeglicht sicheres Offline-Login durch Credential-Caching
 */

interface OfflineCredentials {
  username: string;
  passwordHash: string; // SHA-256 Hash des Passworts (nur fuer Offline-Verifikation)
  salt?: string; // Zufaelliger Salt fuer den Hash (fehlt in alten Eintraegen ohne Salt)
  userId: string;
  displayName: string;
  role: string;
  vehicleId: string | null;
  permissions: string[];
  lastSync: number;
}

const OFFLINE_CREDS_KEY = 'lv-offline-credentials';
const OFFLINE_TOKEN_KEY = 'lv-offline-token';

interface OfflineTokenPayload extends Record<string, unknown> {
  exp?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseOfflineCredentials(value: string): OfflineCredentials | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }

    const username = parsed.username;
    const passwordHash = parsed.passwordHash;
    const salt = parsed.salt;
    const userId = parsed.userId;
    const displayName = parsed.displayName;
    const role = parsed.role;
    const vehicleId = parsed.vehicleId;
    const permissions = parsed.permissions;
    const lastSync = parsed.lastSync;

    if (typeof username !== "string" || typeof passwordHash !== "string" || typeof userId !== "string" || typeof displayName !== "string" || typeof role !== "string") {
      return null;
    }
    if (salt !== undefined && typeof salt !== "string") {
      return null;
    }
    if (!(vehicleId === null || typeof vehicleId === "string")) {
      return null;
    }
    if (!Array.isArray(permissions) || !permissions.every((permission) => typeof permission === "string")) {
      return null;
    }
    if (typeof lastSync !== "number") {
      return null;
    }

    return {
      username,
      passwordHash,
      salt: typeof salt === "string" ? salt : undefined,
      userId,
      displayName,
      role,
      vehicleId,
      permissions,
      lastSync,
    };
  } catch {
    return null;
  }
}

/**
 * SHA-256 Hash fuer Passwort-Verifikation (client-side, nur fuer Offline-Modus).
 * WICHTIG: Dies ist NICHT fuer Server-Authentifizierung geeignet!
 * Erfordert HTTPS, da crypto.subtle nur in sicheren Kontexten verfuegbar ist.
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + password));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new Error('Offline-Anmeldung erfordert HTTPS (crypto.subtle nicht verfügbar)');
  }
}

/**
 * Speichert Credentials fuer Offline-Login (nach erfolgreichem Online-Login).
 */
export async function saveOfflineCredentials(
  username: string,
  password: string,
  user: {
    id: string;
    displayName: string;
    role: string;
    vehicleId: string | null;
    permissions?: string[];
  }
): Promise<void> {
  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const passwordHash = await hashPassword(password, salt);

  const credentials: OfflineCredentials = {
    username,
    passwordHash,
    salt,
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    vehicleId: user.vehicleId,
    permissions: user.permissions || [],
    lastSync: Date.now()
  };

  localStorage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(credentials));

  // Verifikation: sicherstellen dass Daten korrekt gespeichert wurden
  const stored = localStorage.getItem(OFFLINE_CREDS_KEY);
  if (!stored) {
    throw new Error('Offline-Credentials konnten nicht in localStorage gespeichert werden');
  }
  const parsed = parseOfflineCredentials(stored);
  if (!parsed || parsed.username !== username) {
    throw new Error('Gespeicherte Offline-Credentials sind inkonsistent');
  }
}

/**
 * Verifiziert Credentials fuer Offline-Login.
 */
export async function verifyOfflineCredentials(
  username: string,
  password: string
): Promise<OfflineCredentials | null> {
  try {
    const stored = localStorage.getItem(OFFLINE_CREDS_KEY);
    if (!stored) {
      return null;
    }

    const credentials = parseOfflineCredentials(stored);
    if (!credentials) {
      return null;
    }

    // Username-Check (case-insensitive)
    if (credentials.username.toLowerCase() !== username.toLowerCase()) {
      return null;
    }

    // Rueckwaertskompatibilitaet: Alte Eintraege ohne Salt sind unsicher und werden verworfen
    if (!credentials.salt) {
      localStorage.removeItem(OFFLINE_CREDS_KEY);
      return null;
    }

    // Passwort-Hash-Verifikation mit Salt
    const passwordHash = await hashPassword(password, credentials.salt);
    if (credentials.passwordHash !== passwordHash) {
      return null;
    }

    // Credentials aelter als 30 Tage: Warnung, aber Login trotzdem erlauben
    const age = Date.now() - credentials.lastSync;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 Tage
    if (age > maxAge) {
      console.warn('[OfflineAuth] Offline-Credentials sind aelter als 30 Tage – bitte online anmelden');
    }

    return credentials;
  } catch {
    return null;
  }
}

/**
 * Generiert einen Offline-Token (nur fuer Client-seitige Offline-Nutzung).
 * SICHERHEITSHINWEIS: Dieser Token ist nicht kryptographisch signiert und wird
 * nur im Offline-Modus verwendet. Das Backend akzeptiert ihn NICHT.
 */
export function generateOfflineToken(credentials: OfflineCredentials): string {
  const payload = {
    sub: credentials.userId,
    username: credentials.username,
    role: credentials.role,
    displayName: credentials.displayName,
    vehicleId: credentials.vehicleId,
    permissions: credentials.permissions,
    offline: true,
    iat: Date.now(),
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 Tage Gueltigkeit (Offline-Techniker)
  };

  const tokenData = JSON.stringify(payload);
  const token = btoa(encodeURIComponent(tokenData));

  return `offline.${token}`;
}

/**
 * Generiert einen Offline-Token aus dem gecachten User-Profil.
 * Kein Passwort noetig — fuer automatische Session-Wiederherstellung nach F5 im Offline-Modus.
 * Das Backend akzeptiert diesen Token NICHT.
 */
export function generateOfflineTokenFromProfile(profile: {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  vehicleId: string | null;
  permissions: string[];
}): string {
  const payload = {
    sub: profile.userId,
    username: profile.username,
    role: profile.role,
    displayName: profile.displayName,
    vehicleId: profile.vehicleId,
    permissions: profile.permissions,
    offline: true,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const token = btoa(encodeURIComponent(JSON.stringify(payload)));
  return `offline.${token}`;
}

/**
 * Validiert Offline-Token (nur fuer Offline-Betrieb).
 */
export function validateOfflineToken(token: string): OfflineTokenPayload | null {
  try {
    if (!token.startsWith('offline.')) {
      return null;
    }

    const tokenData = token.substring(8);
    const decoded = decodeURIComponent(atob(tokenData));
    const parsed: unknown = JSON.parse(decoded);
    if (!isRecord(parsed)) {
      return null;
    }
    const payload = parsed as OfflineTokenPayload;

    if (typeof payload.exp === "number" && Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Bereinigt gespeicherte Offline-Credentials.
 * Hinweis: Wird beim Logout NICHT aufgerufen, damit Techniker offline arbeiten koennen.
 * Verwende diese Funktion nur bei explizitem Wunsch des Benutzers.
 */
export function clearOfflineCredentials(): void {
  localStorage.removeItem(OFFLINE_CREDS_KEY);
  localStorage.removeItem(OFFLINE_TOKEN_KEY);
}

/**
 * Prueft, ob Offline-Login moeglich ist.
 */
export function hasOfflineCredentials(): boolean {
  return localStorage.getItem(OFFLINE_CREDS_KEY) !== null;
}
