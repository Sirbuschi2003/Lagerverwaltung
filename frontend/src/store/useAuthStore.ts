import { create } from "zustand";
import { persist } from "zustand/middleware";
import api, { fetchAuthProfile, type AuthProfileDto } from "../utils/api";
import { SecureTokenManager, SecurityLogger, validateAuthToken, sanitizeInput } from "../utils/securityUtils";
import { useNetworkStore } from "./useNetworkStore";
import { useUserSettingsStore } from "./useUserSettingsStore";
import useTabStore from "./useTabStore";

type UserProfile = AuthProfileDto;

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  lastActivity: number;
  login: (params: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  updateUserRefreshInterval: (userId: string, interval: number) => Promise<void>;
  checkTokenValidity: () => boolean;
  updateLastActivity: () => void;
  isSessionExpired: () => boolean;
  hasPermission: (permission: string | string[]) => boolean;
}

interface ApiErrorResponse {
  status?: number;
}

interface ApiErrorLike {
  response?: ApiErrorResponse;
  code?: string;
  message?: string;
}

const toApiError = (value: unknown): ApiErrorLike => {
  if (typeof value === "object" && value !== null) {
    return value as ApiErrorLike;
  }
  return {};
};

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 Stunden bei aktiver Online-Verbindung
const OFFLINE_SESSION_GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage Offline-Betrieb (Techniker ohne Netz)

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      lastActivity: Date.now(),

      login: async ({ username, password }) => {
        const sanitizedUsername = sanitizeInput(username);
        // Passwort NICHT sanitizen (enthaelt moeglicherweise Sonderzeichen)
        const sanitizedPassword = password;

        SecurityLogger.logSecurityEvent('login_attempt', { username: sanitizedUsername });

        // OFFLINE-FIRST: Wenn offline, direkt Offline-Login versuchen
        if (!navigator.onLine) {
          try {
            const { verifyOfflineCredentials, generateOfflineToken } = await import('../utils/offlineAuth');
            const credentials = await verifyOfflineCredentials(sanitizedUsername, sanitizedPassword);

            if (credentials) {
              const offlineToken = generateOfflineToken(credentials);
              const offlineUser: UserProfile = {
                id: credentials.userId,
                username: credentials.username,
                displayName: credentials.displayName,
                role: credentials.role,
                vehicleId: credentials.vehicleId,
                permissions: credentials.permissions,
                refreshInterval: 30000
              };

              api.defaults.headers.common.Authorization = `Bearer ${offlineToken}`;
              set({ token: offlineToken, refreshToken: null, user: offlineUser, lastActivity: Date.now() });

              SecurityLogger.logSecurityEvent('offline_login_success', {
                username: credentials.username,
                userId: credentials.userId
              });
              return;
            } else {
              throw new Error('Offline-Login: Benutzername oder Passwort falsch');
            }
          } catch (offlineError) {
            throw offlineError;
          }
        }

        // ONLINE-LOGIN: Normale Authentifizierung
        try {
          const response = await api.post<AuthResponse>("/auth/login", {
            username: sanitizedUsername,
            password: sanitizedPassword
          });

          const data = response.data as any;
          if (data.requiresMfa && data.mfaToken) {
            const err = new Error('MFA_REQUIRED') as any;
            err.mfaToken = data.mfaToken;
            throw err;
          }

          const { accessToken, user } = response.data;

          if (!validateAuthToken(accessToken)) {
            SecurityLogger.logSecurityEvent('invalid_token_received', { username: sanitizedUsername });
            throw new Error('Invalid token received from server');
          }

          SecureTokenManager.setToken(accessToken, 8);
          // Refresh-Token wird jetzt als HttpOnly-Cookie vom Backend verwaltet (sicherer als localStorage)

          // Alte Cache-Keys bereinigen
          localStorage.removeItem('lv-offline-vehicleId');

          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          set({ token: accessToken, refreshToken: null, user, lastActivity: Date.now() });

          SecurityLogger.logSecurityEvent('login_success', {
            username: sanitizedUsername,
            userId: user.id
          });

          // Offline-Credentials speichern fuer naechsten Offline-Login
          try {
            const { saveOfflineCredentials } = await import('../utils/offlineAuth');
            await saveOfflineCredentials(sanitizedUsername, sanitizedPassword, {
              id: user.id,
              displayName: user.displayName,
              role: user.role,
              vehicleId: user.vehicleId ?? null,
              permissions: user.permissions
            });
          } catch (err) {
            // Offline-Credentials konnten nicht gespeichert werden – Online-Login trotzdem erfolgreich
          }

          // Profil nach Login aktualisieren
          try {
            await get().refreshProfile();
          } catch {
            // Profile-Refresh fehlgeschlagen – Login war trotzdem erfolgreich
          }
        } catch (error: unknown) {
          const apiError = toApiError(error);
          const status = apiError.response?.status;
          const message = String(apiError.message ?? "").toLowerCase();
          const isNetworkError = status === undefined
            || apiError.code === 'ECONNABORTED'
            || message.includes('network')
            || message.includes('timeout')
            || (status !== undefined && [0, 502, 503, 504].includes(status));

          SecurityLogger.logSecurityEvent('login_failed', {
            username: sanitizeInput(username),
            error: (error as Error).message
          });

          // Netzwerkfehler: Offline-Login als Fallback versuchen
          if (!navigator.onLine || isNetworkError) {
            try {
              const { verifyOfflineCredentials, generateOfflineToken } = await import('../utils/offlineAuth');
              const credentials = await verifyOfflineCredentials(sanitizeInput(username), password);

              if (credentials) {
                const offlineToken = generateOfflineToken(credentials);
                const offlineUser: UserProfile = {
                  id: credentials.userId,
                  username: credentials.username,
                  displayName: credentials.displayName,
                  role: credentials.role,
                  vehicleId: credentials.vehicleId,
                  permissions: credentials.permissions,
                  refreshInterval: 30000
                };

                api.defaults.headers.common.Authorization = `Bearer ${offlineToken}`;
                set({ token: offlineToken, refreshToken: null, user: offlineUser, lastActivity: Date.now() });

                SecurityLogger.logSecurityEvent('offline_login_success', {
                  username: credentials.username,
                  userId: credentials.userId
                });
                return;
              }
            } catch {
              // Offline-Login fehlgeschlagen
            }
          }

          // Fallback: Falls bereits eingeloggt und Token noch gueltig
          const currentToken = get().token;
          const currentUser = get().user;

          if (currentToken && currentUser && !navigator.onLine) {
            if (validateAuthToken(currentToken) && !get().isSessionExpired()) {
              api.defaults.headers.common.Authorization = `Bearer ${currentToken}`;
              get().updateLastActivity();
              return;
            }
          }

          throw error;
        }
      },

      logout: () => {
        SecurityLogger.logSecurityEvent('logout', { userId: get().user?.id });

        // Benutzer-abhaengige Cache-Keys bereinigen
        localStorage.removeItem('lv-offline-vehicleId');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('lv-offline-vehicleId-')) {
            localStorage.removeItem(key);
          }
        });

        // DESIGN-ENTSCHEIDUNG: Offline-Credentials bleiben beim Logout erhalten.
        // Techniker koennen so auch nach dem Logout offline arbeiten (z.B. im Fahrzeug ohne Netz).
        // Die Credentials laufen nach 30 Tagen ab (OFFLINE_SESSION_GRACE_MS).

        delete api.defaults.headers.common.Authorization;
        SecureTokenManager.clearToken();
        useUserSettingsStore.getState().reset();
        // Sicherheit: geöffnete Tabs (auch rollenbeschränkte Seiten wie Firmendaten)
        // dürfen nicht für den nächsten Benutzer in derselben Browser-Session sichtbar bleiben.
        useTabStore.getState().clearTabs();
        set({ token: null, refreshToken: null, user: null, lastActivity: Date.now() });
      },

      hasPermission: (permission: string | string[]) => {
        const user = get().user;
        if (!user) return false;
        const permissions = user.permissions ?? [];
        // DESIGN-ENTSCHEIDUNG: Manager-Rolle hat uneingeschraenkten Vollzugriff.
        // Granulare Berechtigungen gelten nur fuer WAREHOUSE und TECHNICIAN.
        if (user.role === "MANAGER") return true;
        if (Array.isArray(permission)) {
          return permission.some((perm) => permissions.includes(perm));
        }
        return permissions.includes(permission);
      },

      refreshAccessToken: async () => {
        if (!navigator.onLine) return;
        try {
          const response = await api.post<{ accessToken: string; user: UserProfile }>("/auth/refresh", {}, { withCredentials: true });
          const { accessToken, user } = response.data;
          if (!validateAuthToken(accessToken)) return;
          SecureTokenManager.setToken(accessToken, 8);
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          set({ token: accessToken, user, lastActivity: Date.now() });
        } catch {
          // Refresh fehlgeschlagen – bestehende Session behalten
        }
      },

      refreshProfile: async () => {
        const token = get().token;
        if (!token) {
          set({ user: null });
          return;
        }
        const isOfflineToken = token.startsWith('offline.');
        if ((!isOfflineToken && !validateAuthToken(token)) || get().isSessionExpired()) {
          SecurityLogger.logSecurityEvent('session_expired', { userId: get().user?.id });
          get().logout();
          return;
        }
        // Offline: gecachte Daten behalten
        if (!navigator.onLine && get().user) {
          return;
        }
        try {
          const profile = await fetchAuthProfile();
          set({ user: profile, lastActivity: Date.now() });
        } catch (error) {
          if (!navigator.onLine && get().user) {
            return;
          }
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status === 401) {
            SecurityLogger.logSecurityEvent('unauthorized_access', { userId: get().user?.id, endpoint: 'profile' });
            get().logout();
          }
        }
      },

      updateUserRefreshInterval: async (userId: string, interval: number) => {
        try {
          const sanitizedUserId = sanitizeInput(userId);
          const validInterval = Math.max(5, Math.min(300, interval));

          await api.patch(`/users/${sanitizedUserId}/refresh-interval`, {
            refreshInterval: validInterval
          });

          const currentUser = get().user;
          if (currentUser) {
            set({ user: { ...currentUser, refreshInterval: validInterval }, lastActivity: Date.now() });
          }

          SecurityLogger.logSecurityEvent('refresh_interval_updated', {
            userId: sanitizedUserId,
            interval: validInterval
          });
        } catch {
          // Lokaler State bleibt unveraendert bei Fehler
        }
      },

      checkTokenValidity: (): boolean => {
        const token = get().token;
        if (!token) return false;
        const isOfflineToken = token.startsWith('offline.');
        return (isOfflineToken || validateAuthToken(token)) && !get().isSessionExpired();
      },

      updateLastActivity: () => {
        set({ lastActivity: Date.now() });
      },

      isSessionExpired: (): boolean => {
        const { lastActivity } = get();
        const now = Date.now();

        const browserOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
        let backendOnline = true;
        try {
          backendOnline = useNetworkStore.getState().isOnline;
        } catch {
          backendOnline = true;
        }

        const offlineMode = browserOffline || !backendOnline;
        const timeout = offlineMode ? OFFLINE_SESSION_GRACE_MS : SESSION_TIMEOUT_MS;

        return now - lastActivity > timeout;
      },
    }),
    {
      name: "auth-store",
      version: 5,
      // Token wird persistiert damit F5 und App-Reopen ohne Re-Login funktioniert.
      // Abgelaufene JWTs werden beim ersten API-Call per 401-Interceptor via Cookie erneuert.
      partialize: (state) => ({ token: state.token, user: state.user, lastActivity: state.lastActivity }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token || !state?.user) return;
        const isOfflineToken = state.token.startsWith('offline.');
        const tokenValid = isOfflineToken || validateAuthToken(state.token);
        if (tokenValid && !state.isSessionExpired?.()) {
          api.defaults.headers.common.Authorization = `Bearer ${state.token}`;
        } else {
          SecurityLogger.logSecurityEvent('invalid_token_on_startup', {});
          SecureTokenManager.clearToken();
          state.logout?.();
        }
      },
    },
  ),
);

export default useAuthStore;
