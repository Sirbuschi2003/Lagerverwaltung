import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { MarkEmailRead, Send } from "@mui/icons-material";
import useAuthStore from "../store/useAuthStore";
import {
  fetchEmailSettings,
  saveEmailSettings,
  sendTestEmail,
  type EmailConfigResponse,
  type UpdateEmailSettingsRequest,
} from "../utils/api";

const EmailSettingsPage = () => {
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const isManager = hasPermission("settings.email");

  const [form, setForm] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    from: "",
    secure: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }
    fetchEmailSettings()
      .then((settings: EmailConfigResponse) => {
        const cfg = settings.config || {};
        setForm({
          host: cfg.host || "",
          port: cfg.port || 587,
          username: cfg.auth?.user || "",
          password: "",
          from: cfg.from || "",
          secure: Boolean(cfg.secure),
        });
      })
      .catch((err) => {
        console.error("Fehler beim Laden der E-Mail-Einstellungen:", err);
        setMessage({ type: "error", text: "E-Mail-Einstellungen konnten nicht geladen werden." });
      })
      .finally(() => setLoading(false));
  }, [isManager]);

  if (!isManager) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Keine Berechtigung. Nur Administratoren können E-Mail-Einstellungen ändern.</Alert>
      </Container>
    );
  }

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.host.trim() || !form.port || !form.username.trim() || !form.password.trim() || !form.from.trim()) {
      setMessage({ type: "error", text: "Bitte alle Pflichtfelder ausfüllen (Host, Port, Benutzer, Passwort, Absender)." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const payload: UpdateEmailSettingsRequest = {
      host: form.host.trim(),
      port: Number(form.port) || 0,
      username: form.username.trim(),
      password: form.password || "",
      from: form.from.trim(),
      secure: form.secure,
    };

    try {
      await saveEmailSettings(payload);
      setMessage({ type: "success", text: "E-Mail-Einstellungen gespeichert." });
      if (form.password) {
        setForm((prev) => ({ ...prev, password: "" }));
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "E-Mail-Einstellungen konnten nicht gespeichert werden.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient.trim()) {
      setMessage({ type: "error", text: "Bitte Test-Empfänger angeben." });
      return;
    }

    setTesting(true);
    setMessage(null);
    try {
      await sendTestEmail({ email: testRecipient.trim() });
      setMessage({ type: "success", text: "Test-E-Mail wurde gesendet." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Test-E-Mail konnte nicht gesendet werden.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <MarkEmailRead sx={{ mr: 1 }} />
          <Typography variant="h5">E-Mail Einstellungen</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Konfiguriere den Mailserver für Benachrichtigungen und Passwort-Resets.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ opacity: loading ? 0.6 : 1 }}>
          <Grid item xs={12} md={8}>
            <TextField
              label="SMTP Host"
              fullWidth
              value={form.host}
              onChange={(e) => handleChange("host", e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Port"
              type="number"
              fullWidth
              value={form.port}
              onChange={(e) => handleChange("port", Number(e.target.value))}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Benutzername"
              fullWidth
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Passwort"
              type="password"
              fullWidth
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              disabled={loading}
              placeholder="Unverändert lassen zum Beibehalten"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Absender-Adresse"
              fullWidth
              value={form.from}
              onChange={(e) => handleChange("from", e.target.value)}
              disabled={loading}
              placeholder="noreply@example.com"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.secure}
                  onChange={(e) => handleChange("secure", e.target.checked)}
                  disabled={loading}
                />
              }
              label="SSL/TLS verwenden"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={3} flexDirection={{ xs: "column", sm: "row" }}>
          <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Speichert..." : "Speichern"}
          </Button>
          <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
            <TextField
              label="Test-Empfänger"
              fullWidth
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              disabled={loading}
            />
            <Button
              variant="outlined"
              onClick={handleSendTest}
              disabled={testing || loading}
              startIcon={<Send />}
            >
              {testing ? "Sende..." : "Testen"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default EmailSettingsPage;

