import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Link,
  Chip,
  useTheme,
  useMediaQuery,
  alpha,
} from "@mui/material";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import useAuthStore from "../store/useAuthStore";
import useSystemConfigStore from "../store/useSystemConfigStore";
import PasswordResetPage from "./PasswordResetPage";
import { APP_VERSION } from "../utils/version";
import { hasOfflineCredentials } from "../utils/offlineAuth";
import { ModernInput, PasswordInput } from "../components/ModernInput";
import { PrimaryButton } from "../components/ModernButton";
import { designTokens } from "../styles/designTokens";

interface LoginRequestError {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
  code?: string;
  message?: string;
}

const toLoginRequestError = (value: unknown): LoginRequestError => {
  if (typeof value === "object" && value !== null) {
    return value as LoginRequestError;
  }
  return {};
};

const LoginPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const login = useAuthStore((state) => state.login);
  const { companyName, companyLogo } = useSystemConfigStore((state) => ({
    companyName: state.companyName,
    companyLogo: state.companyLogo,
  }));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineLoginAvailable, setOfflineLoginAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setOfflineLoginAvailable(hasOfflineCredentials());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await login({ username, password });
      setSuccess("Erfolgreich angemeldet!");
    } catch (err: unknown) {
      console.error("[LoginPage] Login-Fehler:", err);
      const loginError = toLoginRequestError(err);
      const errorMessage = loginError.message ?? "";

      if (!navigator.onLine) {
        if (offlineLoginAvailable) {
          setError("Benutzername oder Passwort falsch. Bitte verwenden Sie Ihre gespeicherten Anmeldedaten.");
        } else {
          setError("Keine gespeicherten Anmeldedaten verfügbar. Bitte verbinden Sie sich mit dem Internet.");
        }
      } else if (
        loginError.response?.status === 503
        || loginError.code === "ECONNABORTED"
        || errorMessage.includes("timeout")
        || errorMessage.includes("Network Error")
      ) {
        setError("Server nicht erreichbar. Offline-Modus wird versucht...");
      } else if (loginError.response?.data?.error === "OFFLINE_LOGIN_REQUIRED") {
        setError("Offline-Modus: Verwende gespeicherte Anmeldedaten");
      } else {
        setError("Anmeldung fehlgeschlagen - Bitte überprüfen Sie Ihre Eingaben");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showPasswordReset) {
    return <PasswordResetPage onBackToLogin={() => setShowPasswordReset(false)} />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme.palette.mode === "dark"
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
              theme.palette.secondary.main,
              0.1
            )} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(
              theme.palette.secondary.main,
              0.05
            )} 100%)`,
      }}
    >
      <Container maxWidth="sm" sx={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
        {/* Offline-Status-Anzeige */}
        {isOffline && (
          <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
            <Chip
              icon={<WifiOffIcon />}
              label={offlineLoginAvailable ? "Offline-Modus (Login verfügbar)" : "Offline-Modus"}
              color={offlineLoginAvailable ? "warning" : "error"}
              variant="outlined"
              sx={{
                fontSize: "0.875rem",
                py: 2.5,
                fontWeight: 500,
              }}
            />
          </Box>
        )}

        {/* Firmenlogo & Name */}
        {(companyLogo || companyName) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 4,
              gap: 2,
            }}
          >
            {companyLogo && (
              <Box
                component="img"
                src={companyLogo}
                alt={companyName || "Firmenlogo"}
                sx={{
                  maxWidth: isMobile ? 120 : 160,
                  maxHeight: isMobile ? 60 : 80,
                  objectFit: "contain",
                  borderRadius: designTokens.borderRadius.md,
                }}
              />
            )}
            {companyName && (
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {companyName}
              </Typography>
            )}
          </Box>
        )}

        {/* Login Card */}
        <Paper
          component="form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: designTokens.borderRadius.lg,
            boxShadow: designTokens.shadows.lg,
            backdropFilter: "blur(8px)",
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
          }}
        >
          {/* Header */}
          <Box sx={{ mb: 3, textAlign: "center" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "50%",
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LockIcon sx={{ color: theme.palette.primary.main, fontSize: "2rem" }} />
              </Box>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                mb: 1,
              }}
            >
              Anmeldung
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Melden Sie sich mit Ihren Anmeldedaten an
            </Typography>
          </Box>

          {/* Alerts */}
          {isOffline && offlineLoginAvailable && (
            <Alert
              severity="info"
              icon={<CheckCircleIcon />}
              sx={{ mb: 2, borderRadius: designTokens.borderRadius.md }}
            >
              Sie können sich mit Ihren gespeicherten Anmeldedaten einloggen
            </Alert>
          )}

          {error && (
            <Alert
              severity={isOffline && offlineLoginAvailable ? "warning" : "error"}
              sx={{ mb: 2, borderRadius: designTokens.borderRadius.md }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: designTokens.borderRadius.md }}>
              {success}
            </Alert>
          )}

          {/* Form Inputs */}
          <Box sx={{ mb: 2 }}>
            <ModernInput
              label="Benutzername"
              placeholder="Geben Sie Ihren Benutzernamen ein"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              disabled={isLoading}
              fullWidth
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <PasswordInput
              label="Passwort"
              placeholder="Geben Sie Ihr Passwort ein"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              showStrength={false}
              fullWidth
            />
          </Box>

          {/* Submit Button */}
          <PrimaryButton
            type="submit"
            fullWidth
            size="large"
            loading={isLoading}
            disabled={!username || !password || isLoading}
            sx={{
              mb: 2,
              py: 1.5,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {isOffline ? "Offline-Login" : "Anmelden"}
          </PrimaryButton>

          {/* Passwort Reset Link */}
          {!isOffline && (
            <Box sx={{ textAlign: "center" }}>
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPasswordReset(true);
                }}
                sx={{
                  textDecoration: "none",
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: designTokens.transitions.fast,
                  "&:hover": {
                    color: theme.palette.primary.light,
                    textDecoration: "underline",
                  },
                }}
              >
                Passwort vergessen?
              </Link>
            </Box>
          )}
        </Paper>

        {/* Version Info */}
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">
            Lagerverwaltung v{APP_VERSION}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default LoginPage;
