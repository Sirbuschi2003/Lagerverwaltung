import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Save, Refresh } from "@mui/icons-material";
import {
  fetchPurchaseOrderEmailTemplate,
  updatePurchaseOrderEmailTemplate,
  type EmailTemplate,
} from "../utils/api";

const PLACEHOLDERS = [
  { key: "{{orderNumber}}", description: "Bestellnummer (z.B. TOSHI-20260127-001)" },
  { key: "{{supplierName}}", description: "Name des Lieferanten" },
  { key: "{{positions}}", description: "Artikelpositionen mit Menge (mehrzeilig)" },
  { key: "{{companyName}}", description: "Ihr Firmenname" },
  { key: "{{companyEmail}}", description: "Ihre Firmen-E-Mail" },
  { key: "{{companyPhone}}", description: "Ihre Firmen-Telefonnummer" },
  { key: "{{userName}}", description: "Login-Name des Benutzers" },
];

const PurchaseOrderEmailTemplatePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [template, setTemplate] = useState<EmailTemplate>({
    subject: "",
    body: "",
  });

  const loadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrderEmailTemplate();
      setTemplate(data);
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Laden der Vorlage: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePurchaseOrderEmailTemplate(template);
      setSuccess("E-Mail-Vorlage erfolgreich gespeichert!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Speichern: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const insertPlaceholder = (placeholder: string, field: "subject" | "body") => {
    if (field === "subject") {
      setTemplate((prev) => ({
        ...prev,
        subject: prev.subject + placeholder,
      }));
    } else {
      setTemplate((prev) => ({
        ...prev,
        body: prev.body + placeholder,
      }));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <Typography variant="h4" gutterBottom>
        E-Mail-Vorlage für Bestellungen
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Diese Vorlage wird verwendet, wenn Bestellungen per E-Mail versendet werden. 
        Verwenden Sie Platzhalter, um dynamische Werte einzufügen.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Verfügbare Platzhalter */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Verfügbare Platzhalter
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              Klicken Sie auf einen Platzhalter, um ihn einzufügen:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {PLACEHOLDERS.map((p) => (
                <Chip
                  key={p.key}
                  label={`${p.key} - ${p.description}`}
                  onClick={() => {
                    // Setze Cursor-Position (vereinfacht: am Ende)
                    document.getElementById("subject-field")?.focus();
                  }}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Betreff */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              E-Mail-Betreff
            </Typography>
            <TextField
              id="subject-field"
              fullWidth
              label="Betreff"
              value={template.subject}
              onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
              placeholder="z.B. Bestellung {{orderNumber}}"
              helperText="Verwenden Sie Platzhalter wie {{orderNumber}} oder {{supplierName}}"
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {PLACEHOLDERS.map((p) => (
                <Button
                  key={p.key}
                  size="small"
                  variant="outlined"
                  onClick={() => insertPlaceholder(p.key, "subject")}
                >
                  {p.key}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Nachricht */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              E-Mail-Text
            </Typography>
            <TextField
              id="body-field"
              fullWidth
              multiline
              rows={10}
              label="Nachricht"
              value={template.body}
              onChange={(e) => setTemplate({ ...template, body: e.target.value })}
              placeholder="z.B. Sehr geehrte Damen und Herren,&#10;&#10;anbei erhalten Sie unsere Bestellung {{orderNumber}}.&#10;&#10;Mit freundlichen Grüßen&#10;{{companyName}}"
              helperText="Verwenden Sie \\n für Zeilenumbrüche und z.B. {{positions}} für die Artikelzeilen."
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {PLACEHOLDERS.map((p) => (
                <Button
                  key={p.key}
                  size="small"
                  variant="outlined"
                  onClick={() => insertPlaceholder(p.key, "body")}
                >
                  {p.key}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Vorschau */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vorschau
            </Typography>
            <Box sx={{ bgcolor: "grey.100", p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Betreff:</strong> {template.subject || "(leer)"}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 2 }}>
                {template.body || "(leer)"}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Hinweis: Platzhalter werden beim Versand automatisch durch die echten Werte ersetzt.
            </Typography>
          </CardContent>
        </Card>

        {/* Aktionen */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={saving || !template.subject || !template.body}
          >
            {saving ? "Speichere..." : "Speichern"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadTemplate}
            disabled={loading || saving}
          >
            Zurücksetzen
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default PurchaseOrderEmailTemplatePage;
