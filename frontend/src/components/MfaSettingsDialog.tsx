import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import PhonelinkLockIcon from "@mui/icons-material/PhonelinkLock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import api from "../utils/api";
import { ModernInput, PasswordInput } from "./ModernInput";
import { PrimaryButton } from "./ModernButton";

interface MfaSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type View = "status" | "setup" | "disable";

interface SetupData {
  qrCodeDataUrl: string;
  secret: string;
}

const MfaSettingsDialog: React.FC<MfaSettingsDialogProps> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [view, setView] = useState<View>("status");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setView("status");
    setError(null);
    setTotpCode("");
    setDisablePassword("");
    setSetupData(null);
    setActiveStep(0);
    void loadStatus();
  }, [open]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ mfaEnabled: boolean }>("/auth/mfa/status");
      setMfaEnabled(data.mfaEnabled);
    } catch {
      setError("Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<SetupData>("/auth/mfa/setup");
      setSetupData(data);
      setView("setup");
      setActiveStep(0);
    } catch {
      setError("Einrichtung konnte nicht gestartet werden.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/mfa/verify-setup", { totpCode });
      setMfaEnabled(true);
      setView("status");
      setSetupData(null);
      setTotpCode("");
    } catch {
      setError("Ungültiger Code. Bitte prüfen Sie Ihre Authenticator-App.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/mfa/disable", { password: disablePassword });
      setMfaEnabled(false);
      setView("status");
      setDisablePassword("");
    } catch {
      setError("Deaktivierung fehlgeschlagen. Passwort falsch?");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setView("status");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PhonelinkLockIcon color="primary" />
        Zwei-Faktor-Authentifizierung
      </DialogTitle>

      <DialogContent>
        {loading && view === "status" ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : view === "status" ? (
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
              {mfaEnabled ? (
                <CheckCircleIcon color="success" />
              ) : (
                <PhonelinkLockIcon color="disabled" />
              )}
              <Box>
                <Typography fontWeight={600}>
                  {mfaEnabled ? "2FA ist aktiviert" : "2FA ist deaktiviert"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mfaEnabled
                    ? "Ihr Konto ist durch einen Authenticator-Code geschützt."
                    : "Schützen Sie Ihr Konto mit einer Authenticator-App (Google Authenticator, Aegis, …)."}
                </Typography>
              </Box>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Divider />

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button onClick={handleClose} variant="outlined">
                Schließen
              </Button>
              {mfaEnabled ? (
                <Button
                  color="error"
                  variant="contained"
                  onClick={() => { setView("disable"); setError(null); }}
                >
                  2FA deaktivieren
                </Button>
              ) : (
                <PrimaryButton onClick={() => { void handleStartSetup(); }} loading={loading}>
                  2FA einrichten
                </PrimaryButton>
              )}
            </Box>
          </Stack>
        ) : view === "setup" && setupData ? (
          <Stack spacing={3}>
            <Stepper activeStep={activeStep} orientation="vertical">
              <Step>
                <StepLabel>App installieren</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Installieren Sie eine Authenticator-App, z. B. <strong>Google Authenticator</strong>,{" "}
                    <strong>Aegis</strong> oder <strong>Microsoft Authenticator</strong>.
                  </Typography>
                  <Button variant="contained" size="small" onClick={() => setActiveStep(1)}>
                    Weiter
                  </Button>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>QR-Code scannen</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Scannen Sie diesen QR-Code mit Ihrer App. Alternativ geben Sie den Schlüssel manuell ein.
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
                    <Box
                      component="img"
                      src={setupData.qrCodeDataUrl}
                      alt="TOTP QR-Code"
                      sx={{ width: 180, height: 180, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-all", mb: 1.5 }}>
                    Manueller Schlüssel: <strong>{setupData.secret}</strong>
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="outlined" size="small" onClick={() => setActiveStep(0)}>
                      Zurück
                    </Button>
                    <Button variant="contained" size="small" onClick={() => setActiveStep(2)}>
                      Weiter
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Code bestätigen</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Geben Sie den 6-stelligen Code aus Ihrer App ein, um die Einrichtung abzuschließen.
                  </Typography>
                  {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
                  <ModernInput
                    label="Authenticator-Code"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    fullWidth
                  />
                  <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                    <Button variant="outlined" size="small" onClick={() => setActiveStep(1)}>
                      Zurück
                    </Button>
                    <PrimaryButton
                      size="small"
                      loading={loading}
                      disabled={totpCode.length !== 6 || loading}
                      onClick={() => { void handleVerifySetup(); }}
                    >
                      Bestätigen & aktivieren
                    </PrimaryButton>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="text"
                onClick={() => { setView("status"); setError(null); setTotpCode(""); }}
              >
                Abbrechen
              </Button>
            </Box>
          </Stack>
        ) : view === "disable" ? (
          <Stack spacing={2}>
            <Alert severity="warning">
              Wenn Sie 2FA deaktivieren, ist Ihr Konto nur noch durch Ihr Passwort geschützt.
            </Alert>

            <PasswordInput
              label="Passwort zur Bestätigung"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              showStrength={false}
              fullWidth
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => { setView("status"); setError(null); setDisablePassword(""); }}
              >
                Abbrechen
              </Button>
              <PrimaryButton
                color="error"
                loading={loading}
                disabled={!disablePassword || loading}
                onClick={() => { void handleDisable(); }}
              >
                2FA deaktivieren
              </PrimaryButton>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default MfaSettingsDialog;
