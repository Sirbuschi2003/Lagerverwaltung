import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
} from '@mui/material';
import { ExpandMore, Save, Refresh } from '@mui/icons-material';
import { getPdfHtmlTemplate, updatePdfHtmlTemplate, PdfHtmlTemplate } from '../utils/api';

const PdfTemplateEditorPage: React.FC = () => {
  const [template, setTemplate] = useState<PdfHtmlTemplate>({ html: '', css: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    loadTemplate();
  }, []);

  useEffect(() => {
    updatePreview();
  }, [template]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const data = await getPdfHtmlTemplate();
      setTemplate(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Fehler beim Laden des Templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updatePdfHtmlTemplate(template);
      setSuccess('Template erfolgreich gespeichert');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const updatePreview = () => {
    // Sample data for preview
    const sampleData = {
      title: 'Lagerverwaltung - QR-Katalog',
      subtitle: 'Erstellt am 23.12.2025, 14:30:00',
      vehicle: 'AB-CD 1234',
      technician: 'Max Mustermann',
      logo: '', // Empty for preview
      items: [
        {
          code: '12345',
          manufacturer: 'Bosch',
          description: 'Bremsscheibe vorne',
          secondaryDescription: '280mm',
          qrCodeDataUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==',
        },
        {
          code: '67890',
          manufacturer: 'Mann',
          description: 'Ölfilter',
          secondaryDescription: '',
          qrCodeDataUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==',
        },
      ],
    };

    let html = template.html;

    // Simple mustache-style replacement
    const replaceSimple = (text: string, key: string, value: string) => {
      return text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    };

    const replaceConditional = (text: string, key: string, value: any, content: string) => {
      const showPattern = new RegExp(`\\{\\{#${key}\\}\\}[\\s\\S]*?\\{\\{\\/${key}\\}\\}`, 'g');
      const hidePattern = new RegExp(`\\{\\{\\^${key}\\}\\}[\\s\\S]*?\\{\\{\\/${key}\\}\\}`, 'g');
      text = text.replace(showPattern, value ? content : '');
      text = text.replace(hidePattern, value ? '' : content);
      return text;
    };

    html = replaceSimple(html, 'title', sampleData.title);
    html = replaceSimple(html, 'subtitle', sampleData.subtitle);
    html = replaceConditional(html, 'vehicle', sampleData.vehicle, sampleData.vehicle);
    html = replaceSimple(html, 'vehicle', sampleData.vehicle);
    html = replaceConditional(html, 'technician', sampleData.technician, sampleData.technician);
    html = replaceSimple(html, 'technician', sampleData.technician);
    html = replaceConditional(html, 'logo', sampleData.logo, sampleData.logo);
    html = replaceSimple(html, 'logo', sampleData.logo);

    // Build group headers HTML
    const groupHeaderMatch = html.match(/\{\{#groupHeaders\}\}([\s\S]*?)\{\{\/groupHeaders\}\}/);
    if (groupHeaderMatch) {
      const groupHeaderTemplate = groupHeaderMatch[1];
      const groupHeaderHtml = groupHeaderTemplate.replace(/\{\{groupName\}\}/g, 'Bremsanlage');
      html = html.replace(/\{\{#groupHeaders\}\}[\s\S]*?\{\{\/groupHeaders\}\}/g, groupHeaderHtml);
    } else {
      html = html.replace(/\{\{#groupHeaders\}\}[\s\S]*?\{\{\/groupHeaders\}\}/g, '');
    }

    // Build items HTML
    const itemMatch = html.match(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/);
    if (itemMatch) {
      const itemTemplate = itemMatch[1];
      let itemsHtml = '';
      
      for (const item of sampleData.items) {
        let itemHtml = itemTemplate;
        itemHtml = replaceConditional(itemHtml, 'manufacturerTag', item.manufacturer, item.manufacturer);
        itemHtml = replaceSimple(itemHtml, 'manufacturer', item.manufacturer);
        itemHtml = replaceSimple(itemHtml, 'code', item.code);
        itemHtml = replaceSimple(itemHtml, 'description', item.description);
        itemHtml = replaceConditional(itemHtml, 'secondaryDescription', item.secondaryDescription, item.secondaryDescription);
        itemHtml = replaceSimple(itemHtml, 'secondaryDescription', item.secondaryDescription);
        itemHtml = replaceSimple(itemHtml, 'qrCodeDataUrl', item.qrCodeDataUrl);
        itemsHtml += itemHtml;
      }
      
      html = html.replace(/\{\{#items\}\}[\s\S]*?\{\{\/items\}\}/g, itemsHtml);
    }

    // Inject CSS
    html = html.replace('</head>', `<style>${template.css}</style></head>`);

    setPreviewHtml(html);
  };

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
        PDF Template Editor
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Hier können Sie das HTML- und CSS-Template für die PDF-Generierung anpassen.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Verfügbare Platzhalter</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" component="div">
                  <strong>Einfache Platzhalter:</strong><br />
                  • <code>{'{{title}}'}</code> - Titel des Dokuments<br />
                  • <code>{'{{subtitle}}'}</code> - Untertitel (z.B. Erstelldatum)<br />
                  • <code>{'{{logo}}'}</code> - Firmenlogo (Data URL)<br />
                  • <code>{'{{vehicle}}'}</code> - Fahrzeug-Kennzeichen<br />
                  • <code>{'{{technician}}'}</code> - Monteur-Name<br />
                  • <code>{'{{code}}'}</code> - Artikelnummer<br />
                  • <code>{'{{manufacturer}}'}</code> - Hersteller<br />
                  • <code>{'{{description}}'}</code> - Beschreibung<br />
                  • <code>{'{{secondaryDescription}}'}</code> - Zusatzbeschreibung<br />
                  • <code>{'{{qrCodeDataUrl}}'}</code> - QR-Code als Data URL<br />
                  • <code>{'{{groupName}}'}</code> - Warengruppe<br />
                  <br />
                  <strong>Bedingte Blöcke (Mustache-style):</strong><br />
                  • <code>{'{{#logo}}...{{/logo}}'}</code> - Zeige nur wenn Logo vorhanden<br />
                  • <code>{'{{#vehicle}}...{{/vehicle}}'}</code> - Zeige nur wenn Fahrzeug vorhanden<br />
                  • <code>{'{{#technician}}...{{/technician}}'}</code> - Zeige nur wenn Monteur vorhanden<br />
                  • <code>{'{{#manufacturerTag}}...{{/manufacturerTag}}'}</code> - Zeige nur wenn Hersteller vorhanden<br />
                  • <code>{'{{#secondaryDescription}}...{{/secondaryDescription}}'}</code> - Zeige nur wenn Zusatzbeschreibung vorhanden<br />
                  <br />
                  <strong>Listen (automatisch iteriert):</strong><br />
                  • <code>{'{{#groupHeaders}}...{{/groupHeaders}}'}</code> - Warengruppen-Header<br />
                  • <code>{'{{#items}}...{{/items}}'}</code> - Artikel-Zeilen<br />
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              HTML Template
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={20}
              value={template.html}
              onChange={(e) => setTemplate({ ...template, html: e.target.value })}
              variant="outlined"
              sx={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              CSS Styles
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={20}
              value={template.css}
              onChange={(e) => setTemplate({ ...template, css: e.target.value })}
              variant="outlined"
              sx={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadTemplate}
            >
              Zurücksetzen
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Live Vorschau</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'white',
                  border: '1px solid #ddd',
                  minHeight: '600px',
                  overflow: 'auto',
                }}
              >
                <iframe
                  title="PDF Preview"
                  srcDoc={previewHtml}
                  style={{
                    width: '100%',
                    minHeight: '800px',
                    border: 'none',
                  }}
                />
              </Paper>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PdfTemplateEditorPage;
