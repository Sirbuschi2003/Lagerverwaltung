import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  Stack,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ButtonGroup,
} from '@mui/material';
import { ExpandMore, Save, Refresh, Download, CloudUpload } from '@mui/icons-material';
import { ChromePicker, ColorResult } from 'react-color';
import { getPdfHtmlTemplate, updatePdfHtmlTemplate, PdfHtmlTemplate } from '../utils/api';

interface PdfTemplateSettings {
  // Layout
  showLogo: boolean;
  showVehicle: boolean;
  showTechnician: boolean;
  showManufacturerTag: boolean;
  showGroupHeaders: boolean;
  showSecondaryDescription: boolean;

  // Sizing
  qrSize: number; // 48-120
  codeWidth: number; // 80-160
  descWidth: number; // 200-500
  manufacturerWidth: number; // 80-200
  fontSize: number; // 8-14
  headerFontSize: number; // 10-20

  // Colors
  headerBgColor: string;
  headerTextColor: string;
  groupHeaderBgColor: string;
  groupHeaderTextColor: string;
  rowBgColor: string;
  rowTextColor: string;
  borderColor: string;
  alternateRowBgColor: string;

  // Spacing
  rowPadding: number; // 4-16
  cellSpacing: number; // 0-8

  // Page layout
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

const DEFAULT_SETTINGS: PdfTemplateSettings = {
  showLogo: true,
  showVehicle: true,
  showTechnician: true,
  showManufacturerTag: true,
  showGroupHeaders: false,
  showSecondaryDescription: true,

  qrSize: 64,
  codeWidth: 140,
  manufacturerWidth: 140,
  descWidth: 280,
  fontSize: 10,
  headerFontSize: 16,

  headerBgColor: '#f0f0f0',
  headerTextColor: '#000000',
  groupHeaderBgColor: '#e8e8e8',
  groupHeaderTextColor: '#000000',
  rowBgColor: '#ffffff',
  rowTextColor: '#000000',
  borderColor: '#dddddd',
  alternateRowBgColor: '#f9f9f9',

  rowPadding: 8,
  cellSpacing: 0,

  orientation: 'portrait',
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 20,
  marginRight: 20,
};

const PdfTemplateBuilderPage: React.FC = () => {
  const [settings, setSettings] = useState<PdfTemplateSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [colorPicker, setColorPicker] = useState<string | null>(null);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const data = await getPdfHtmlTemplate();
      // Parse existing template or use defaults
      setSettings(DEFAULT_SETTINGS);
      setError(null);
    } catch (err: any) {
      console.warn('Error loading template:', err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const generateHtmlTemplate = (s: PdfTemplateSettings): PdfHtmlTemplate => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
</head>
<body>
  <div class="header">
    {{#logo}}<img src="{{logo}}" class="logo" />{{/logo}}
    <h1>{{title}}</h1>
    <p class="subtitle">{{subtitle}}</p>
  </div>

  {{#vehicle}}
  <div class="metadata">
    <strong>Fahrzeug:</strong> {{vehicle}}
  </div>
  {{/vehicle}}

  {{#technician}}
  <div class="metadata">
    <strong>Monteur:</strong> {{technician}}
  </div>
  {{/technician}}

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-code">Artikelnummer</th>
        <th class="col-manufacturer">Hersteller</th>
        <th class="col-description">Bezeichnung</th>
        <th class="col-qr">QR-Code</th>
      </tr>
    </thead>
    <tbody>
      ${s.showGroupHeaders ? `{{#groupHeaders}}
      <tr class="group-header">
        <td colspan="4">{{groupName}}</td>
      </tr>
      {{/groupHeaders}}` : ``}
      {{#items}}
      <tr class="item-row">
        <td class="col-code">{{code}}</td>
        <td class="col-manufacturer">{{manufacturer}}</td>
        <td class="col-description">{{description}}{{#secondaryDescription}} — {{secondaryDescription}}{{/secondaryDescription}}</td>
        <td class="col-qr"><img src="{{qrCodeDataUrl}}" class="qr-code" /></td>
      </tr>
      {{/items}}
    </tbody>
  </table>
</body>
</html>`;

    const css = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

@page {
  size: A4 ${s.orientation === 'landscape' ? 'landscape' : 'portrait'};
  margin: ${s.marginTop}px ${s.marginRight}px ${s.marginBottom}px ${s.marginLeft}px;
}

body {
  font-family: 'Helvetica', 'Arial', sans-serif;
  font-size: ${s.fontSize}pt;
  line-height: 1.4;
  padding: 0;
  color: ${s.rowTextColor};
}

.header {
  position: relative;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid ${s.borderColor};
}

.logo {
  position: absolute;
  top: 0;
  right: 0;
  max-width: 120px;
  max-height: 60px;
}

.header h1 {
  font-size: ${s.headerFontSize}pt;
  margin-bottom: 5px;
  color: ${s.headerTextColor};
}

.subtitle {
  color: #555;
  font-size: ${Math.max(s.fontSize - 2, 8)}pt;
}

.metadata {
  margin-bottom: 8px;
  font-size: ${s.fontSize - 1}pt;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  border-spacing: ${s.cellSpacing}px;
}

.items-table thead th {
  background-color: ${s.headerBgColor};
  padding: ${s.rowPadding}px;
  text-align: left;
  border-bottom: 2px solid ${s.borderColor};
  font-weight: bold;
  color: ${s.headerTextColor};
}

.col-code {
  width: ${s.codeWidth}px;
}

.col-manufacturer {
  width: ${s.manufacturerWidth}px;
}

.col-manufacturer {
  width: ${s.manufacturerWidth}px;
}

.col-description {
  flex: 1;
}

.col-qr {
  width: ${s.qrSize + 20}px;
  text-align: center;
}

.group-header {
  background-color: ${s.groupHeaderBgColor} !important;
}

.group-header td {
  font-weight: bold;
  padding: ${s.rowPadding}px;
  border-top: 1px solid ${s.borderColor};
  color: ${s.groupHeaderTextColor};
}

.item-row {
  background-color: white;
}

.item-row:nth-child(even) {
  background-color: ${s.alternateRowBgColor};
}

.item-row td {
  padding: ${s.rowPadding}px;
  border-bottom: 1px solid ${s.borderColor};
  vertical-align: middle;
}

.qr-code {
  width: ${s.qrSize}px;
  height: ${s.qrSize}px;
}

@media print {
  body {
    padding: 0;
  }
  
  .items-table {
    page-break-inside: auto;
  }
  
  .item-row {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  .group-header {
    page-break-after: avoid;
  }
}`;

    return { html, css };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const template = generateHtmlTemplate(settings);
      await updatePdfHtmlTemplate(template);
      setSuccess('Template erfolgreich gespeichert');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const loadPreset = (preset: Partial<PdfTemplateSettings>) => {
    setSettings({ ...DEFAULT_SETTINGS, ...preset });
  };

  const ColorPickerField: React.FC<{ label: string; colorKey: keyof PdfTemplateSettings; value: string }> = ({
    label,
    colorKey,
    value,
  }) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>{label}</Typography>
      <Button
        variant="outlined"
        onClick={() => setColorPicker(colorPicker === colorKey ? null : (colorKey as string))}
        sx={{
          width: '100%',
          height: '40px',
          backgroundColor: value as string,
          border: `2px solid #ccc`,
          '&:hover': { border: `2px solid #999` },
        }}
      />
      {colorPicker === colorKey && (
        <Box sx={{ position: 'absolute', zIndex: 2, mt: 1 }}>
          <ChromePicker
            color={value as string}
            onChangeComplete={(color: ColorResult) => setSettings({ ...settings, [colorKey]: color.hex })}
          />
        </Box>
      )}
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        QR-Wagenkatalog Vorlage
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Layout für den Wagen-QR-Katalog ohne Code anpassen – Spaltenbreiten, Farben, QR-Größe, Seitenränder.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Presets */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Layout-Vorsets
              </Typography>
              <ButtonGroup fullWidth>
                <Button
                  variant="outlined"
                  onClick={() => loadPreset(DEFAULT_SETTINGS)}
                >
                  Standard
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    loadPreset({
                      qrSize: 48,
                      codeWidth: 100,
                      descWidth: 200,
                      fontSize: 9,
                      rowPadding: 4,
                    })
                  }
                >
                  Kompakt
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    loadPreset({
                      qrSize: 96,
                      codeWidth: 180,
                      descWidth: 400,
                      fontSize: 12,
                      headerFontSize: 20,
                      rowPadding: 12,
                    })
                  }
                >
                  Großformatig
                </Button>
              </ButtonGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Toggle Options */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Anzeige-Optionen
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={<Switch checked={settings.showLogo} onChange={(e) => setSettings({ ...settings, showLogo: e.target.checked })} />}
                  label="Firmenlogo anzeigen"
                />
                <FormControlLabel
                  control={<Switch checked={settings.showVehicle} onChange={(e) => setSettings({ ...settings, showVehicle: e.target.checked })} />}
                  label="Fahrzeug anzeigen"
                />
                <FormControlLabel
                  control={<Switch checked={settings.showTechnician} onChange={(e) => setSettings({ ...settings, showTechnician: e.target.checked })} />}
                  label="Monteur anzeigen"
                />
                <FormControlLabel
                  control={<Switch checked={settings.showManufacturerTag} onChange={(e) => setSettings({ ...settings, showManufacturerTag: e.target.checked })} />}
                  label="Hersteller-Tag anzeigen [Bosch]"
                />
                <FormControlLabel
                  control={<Switch checked={settings.showGroupHeaders} onChange={(e) => setSettings({ ...settings, showGroupHeaders: e.target.checked })} />}
                  label="Warengruppen-Überschriften anzeigen"
                />
                <FormControlLabel
                  control={<Switch checked={settings.showSecondaryDescription} onChange={(e) => setSettings({ ...settings, showSecondaryDescription: e.target.checked })} />}
                  label="Zusatzbeschreibung anzeigen"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sizing */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Größen
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2">QR-Code Größe: {settings.qrSize}px</Typography>
                  <Slider
                    value={settings.qrSize}
                    onChange={(e, val) => setSettings({ ...settings, qrSize: val as number })}
                    min={40}
                    max={120}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Artikelnummer Breite: {settings.codeWidth}px</Typography>
                  <Slider
                    value={settings.codeWidth}
                    onChange={(e, val) => setSettings({ ...settings, codeWidth: val as number })}
                    min={80}
                    max={200}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Hersteller Breite: {settings.manufacturerWidth}px</Typography>
                  <Slider
                    value={settings.manufacturerWidth}
                    onChange={(e, val) => setSettings({ ...settings, manufacturerWidth: val as number })}
                    min={80}
                    max={200}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Beschreibung Breite: {settings.descWidth}px</Typography>
                  <Slider
                    value={settings.descWidth}
                    onChange={(e, val) => setSettings({ ...settings, descWidth: val as number })}
                    min={200}
                    max={500}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Text-Größe: {settings.fontSize}pt</Typography>
                  <Slider
                    value={settings.fontSize}
                    onChange={(e, val) => setSettings({ ...settings, fontSize: val as number })}
                    min={8}
                    max={14}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Titel-Größe: {settings.headerFontSize}pt</Typography>
                  <Slider
                    value={settings.headerFontSize}
                    onChange={(e, val) => setSettings({ ...settings, headerFontSize: val as number })}
                    min={10}
                    max={24}
                    marks
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Spacing */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Abstände
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2">Zellen-Innenabstand: {settings.rowPadding}px</Typography>
                  <Slider
                    value={settings.rowPadding}
                    onChange={(e, val) => setSettings({ ...settings, rowPadding: val as number })}
                    min={4}
                    max={20}
                    marks
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Zellen-Abstand: {settings.cellSpacing}px</Typography>
                  <Slider
                    value={settings.cellSpacing}
                    onChange={(e, val) => setSettings({ ...settings, cellSpacing: val as number })}
                    min={0}
                    max={8}
                    marks
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box>
                  <Typography variant="body2">Oben Rand: {settings.marginTop}px</Typography>
                  <Slider
                    value={settings.marginTop}
                    onChange={(e, val) => setSettings({ ...settings, marginTop: val as number })}
                    min={10}
                    max={50}
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Unten Rand: {settings.marginBottom}px</Typography>
                  <Slider
                    value={settings.marginBottom}
                    onChange={(e, val) => setSettings({ ...settings, marginBottom: val as number })}
                    min={10}
                    max={50}
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Links Rand: {settings.marginLeft}px</Typography>
                  <Slider
                    value={settings.marginLeft}
                    onChange={(e, val) => setSettings({ ...settings, marginLeft: val as number })}
                    min={10}
                    max={50}
                  />
                </Box>
                <Box>
                  <Typography variant="body2">Rechts Rand: {settings.marginRight}px</Typography>
                  <Slider
                    value={settings.marginRight}
                    onChange={(e, val) => setSettings({ ...settings, marginRight: val as number })}
                    min={10}
                    max={50}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Colors */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Farben
              </Typography>
              <Stack spacing={2} sx={{ position: 'relative' }}>
                <ColorPickerField
                  label="Kopfzeile Hintergrund"
                  colorKey="headerBgColor"
                  value={settings.headerBgColor}
                />
                <ColorPickerField
                  label="Kopfzeile Text"
                  colorKey="headerTextColor"
                  value={settings.headerTextColor}
                />
                <ColorPickerField
                  label="Gruppen-Header Hintergrund"
                  colorKey="groupHeaderBgColor"
                  value={settings.groupHeaderBgColor}
                />
                <ColorPickerField
                  label="Gruppen-Header Text"
                  colorKey="groupHeaderTextColor"
                  value={settings.groupHeaderTextColor}
                />
                <ColorPickerField
                  label="Text-Farbe"
                  colorKey="rowTextColor"
                  value={settings.rowTextColor}
                />
                <ColorPickerField
                  label="Zeilen-Hintergrund (wechselnd)"
                  colorKey="alternateRowBgColor"
                  value={settings.alternateRowBgColor}
                />
                <ColorPickerField
                  label="Rahmen-Farbe"
                  colorKey="borderColor"
                  value={settings.borderColor}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Refresh />}
              onClick={loadTemplate}
            >
              Zurücksetzen
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PdfTemplateBuilderPage;
