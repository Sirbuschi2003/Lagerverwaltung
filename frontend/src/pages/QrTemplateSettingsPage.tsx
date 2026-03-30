import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  FormControlLabel,
  Grid,
  Paper,
  Slider,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import { QRCodeSVG } from "qrcode.react";
import useAuthStore from "../store/useAuthStore";
import { getVehicleQrTemplate, updateVehicleQrTemplate, VehicleQrTemplateConfig } from "../utils/api";

const numberSlider = (value: number | undefined, fallback: number) => value ?? fallback;

const QrTemplateSettingsPage: React.FC = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isManager = hasPermission("settings.company");

  const [form, setForm] = useState<VehicleQrTemplateConfig>({
    title: "",
    showLogo: true,
    showVehicle: true,
    showTechnician: true,
    qrSize: 48,
    codeWidth: 110,
    descWidth: 300,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const previewRows = useMemo(() => {
    const rows = [
      {
        code: "6LL43324000",
        manufacturer: "Toshiba",
        description: "GRID-CHARGR-MAIN-K163-K — Coronengitter Ke-2525AC",
        descriptionSecondary: "",
      },
      {
        code: "6LK48944000",
        manufacturer: "Toshiba",
        description: "GRID-CHGR-MAIN-H373-K — Coronengitter Ke-2505-2515A",
        descriptionSecondary: "",
      },
      {
        code: "GO-00732000",
        manufacturer: "HDD",
        description: "MQ01ABU032W",
        descriptionSecondary: "Ersatzlabel mit Zuliefererinfo",
      },
    ];
    return rows;
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getVehicleQrTemplate();
        if (!mounted) return;
        setForm({
          title: data.title ?? "",
          showLogo: data.showLogo !== false,
          showVehicle: data.showVehicle !== false,
          showTechnician: data.showTechnician !== false,
          qrSize: data.qrSize ?? 48,
          codeWidth: data.codeWidth ?? 110,
          descWidth: data.descWidth ?? 300,
          showManufacturerTag: data.showManufacturerTag !== false,
          showGroupHeaders: data.showGroupHeaders !== false,
          showSecondaryDescription: data.showSecondaryDescription !== false,
        });
      } catch (err) {
        if (!mounted) return;
        console.error("QR-Template laden fehlgeschlagen", err);
        setMessage({ type: "error", text: "Vorlage konnte nicht geladen werden." });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: VehicleQrTemplateConfig = {
        title: form.title?.trim() || null,
        showLogo: form.showLogo,
        showVehicle: form.showVehicle,
        showTechnician: form.showTechnician,
        qrSize: form.qrSize,
        codeWidth: form.codeWidth,
        descWidth: form.descWidth,
      };
      const saved = await updateVehicleQrTemplate(payload);
      setForm({
        title: saved.title ?? "",
        showLogo: saved.showLogo !== false,
        showVehicle: saved.showVehicle !== false,
        showTechnician: saved.showTechnician !== false,
        qrSize: saved.qrSize ?? 48,
        codeWidth: saved.codeWidth ?? 110,
        descWidth: saved.descWidth ?? 300,
        showManufacturerTag: saved.showManufacturerTag !== false,
        showGroupHeaders: saved.showGroupHeaders !== false,
        showSecondaryDescription: saved.showSecondaryDescription !== false,
      });
      setMessage({ type: "success", text: "Vorlage gespeichert." });
    } catch (err) {
      console.error("QR-Template speichern fehlgeschlagen", err);
      setMessage({ type: "error", text: "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">Keine Berechtigung.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <DesignServicesIcon />
        <Typography variant="h5">QR-Katalog Vorlage</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Titel (optional)"
              placeholder="z. B. Lagerverwaltung – QR-Katalog (Wagenbestand)"
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              disabled={loading || saving}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.showLogo !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showLogo: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Logo anzeigen"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.showVehicle !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showVehicle: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Fahrzeug anzeigen"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.showTechnician !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showTechnician: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Techniker anzeigen"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.showGroupHeaders !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showGroupHeaders: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Warengruppen-Überschriften anzeigen"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.showManufacturerTag !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showManufacturerTag: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Hersteller-Tag anzeigen"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.showSecondaryDescription !== false}
                  onChange={(e) => setForm((f) => ({ ...f, showSecondaryDescription: e.target.checked }))}
                  disabled={loading || saving}
                />
              }
              label="Zusatzbeschreibung anzeigen"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="body2" sx={{ mb: 1 }}>QR-Größe (px im PDF)</Typography>
            <Slider
              value={numberSlider(form.qrSize, 48)}
              onChange={(_, v) => setForm((f) => ({ ...f, qrSize: v as number }))}
              valueLabelDisplay="auto"
              step={2}
              min={32}
              max={96}
              disabled={loading || saving}
            />

            <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>Spaltenbreite Artikelnummer</Typography>
            <Slider
              value={numberSlider(form.codeWidth, 110)}
              onChange={(_, v) => setForm((f) => ({ ...f, codeWidth: v as number }))}
              valueLabelDisplay="auto"
              step={5}
              min={80}
              max={200}
              disabled={loading || saving}
            />

            <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>Spaltenbreite Bezeichnung</Typography>
            <Slider
              value={numberSlider(form.descWidth, 300)}
              onChange={(_, v) => setForm((f) => ({ ...f, descWidth: v as number }))}
              valueLabelDisplay="auto"
              step={10}
              min={200}
              max={420}
              disabled={loading || saving}
            />
          </Grid>
        </Grid>

        <Box mt={3} display="flex" gap={2}>
          <Button variant="contained" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Speichert..." : "Vorlage speichern"}
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()} disabled={saving}>
            Neu laden
          </Button>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" sx={{ mb: 1 }}>Live-Vorschau</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Beispielhafte Darstellung mit aktuellen Einstellungen (keine echten Lagerdaten).
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            {form.showGroupHeaders !== false && (
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                Warengruppe: Beispiel
              </Typography>
            )}
            {previewRows.map((row, idx) => {
              const parts: string[] = [];
              if (form.showManufacturerTag !== false && row.manufacturer) parts.push(`[${row.manufacturer}]`);
              if (row.description) parts.push(row.description);
              if (form.showSecondaryDescription !== false && row.descriptionSecondary) parts.push('— ' + row.descriptionSecondary);
              const desc = parts.join(' ');
              return (
                <Box key={row.code + idx} sx={{
                  display: "grid",
                  gridTemplateColumns: `${form.codeWidth ?? 110}px ${form.descWidth ?? 300}px ${form.qrSize ?? 48}px`,
                  alignItems: "center",
                  columnGap: 2,
                  py: 1,
                  borderTop: idx === 0 ? '1px solid #ccc' : undefined,
                  borderBottom: '1px solid #eee'
                }}>
                  <Typography variant="subtitle2" sx={{ whiteSpace: "nowrap" }}>{row.code}</Typography>
                  <Typography variant="body2" noWrap>{desc}</Typography>
                  <Box sx={{ width: form.qrSize ?? 48, height: form.qrSize ?? 48, justifySelf: "end" }}>
                    <QRCodeSVG value={row.code} size={form.qrSize ?? 48} />
                  </Box>
                </Box>
              );
            })}
          </Paper>
        </Box>
      </Paper>
    </Container>
  );
};

export default QrTemplateSettingsPage;
