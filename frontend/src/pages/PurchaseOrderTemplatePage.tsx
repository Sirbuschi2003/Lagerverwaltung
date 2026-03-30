import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Delete, Refresh, Save, ZoomIn, ZoomOut } from "@mui/icons-material";
import { Rnd } from "react-rnd";
import {
  getPurchaseOrderPdfDesigner,
  updatePurchaseOrderPdfDesigner,
  updatePurchaseOrderPdfTemplate,
  type PdfHtmlTemplate,
  type PurchaseOrderDesignerConfig,
  type PurchaseOrderDesignerElement,
} from "../utils/api";

const PAGE_SIZES = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
};

const SAMPLE_DATA = {
  companyName: "Musterfirma GmbH",
  companyAddressLine1: "Hauptstrasse 10",
  companyAddressLine2: "2. OG",
  companyPostalCode: "98765",
  companyCity: "Beispielstadt",
  companyCountry: "Deutschland",
  companyPhone: "+49 555 123456",
  companyEmail: "info@musterfirma.de",
  companyLogo:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNlZWUiIC8+PHRleHQgeD0iNjAiIHk9IjM1IiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5MT0dPPC90ZXh0Pjwvc3ZnPg==",
  orderNumber: "PO-2025-001",
  orderDate: "12.01.2025",
  orderStatus: "Bestellt",
  supplierName: "Lieferant GmbH",
  supplierAddressLine1: "Musterstrasse 12",
  supplierAddressLine2: "Gebäude B",
  supplierPostalCode: "12345",
  supplierCity: "Musterstadt",
  supplierCountry: "Deutschland",
  supplierContactName: "Max Mustermann",
  supplierEmail: "kontakt@lieferant.de",
  supplierPhone: "+49 123 456 789",
  supplierCustomerNumber: "KD-998877",
  note: "Bitte schnell liefern.",
  lines: [
    {
      lineIndex: "1",
      itemCode: "A-1001",
      itemDescription: "Bremsbelaege vorne",
      quantity: "6",
      receivedQuantity: "2",
      remainingQuantity: "4",
      packSize: "2",
    },
    {
      lineIndex: "2",
      itemCode: "B-2002",
      itemDescription: "Oelfilter",
      quantity: "10",
      receivedQuantity: "0",
      remainingQuantity: "10",
      packSize: "",
    },
  ],
  totalQuantity: "16",
  totalReceived: "2",
  totalRemaining: "14",
};

const ELEMENT_PALETTE: Array<{
  type: PurchaseOrderDesignerElement["type"];
  label: string;
}> = [
  { type: "companyName", label: "Firmenname" },
  { type: "companyDetails", label: "Firmenadresse" },
  { type: "companyLogo", label: "Firmenlogo" },
  { type: "orderMeta", label: "Bestelldaten" },
  { type: "supplierBlock", label: "Lieferant" },
  { type: "linesTable", label: "Positionen (Tabelle)" },
  { type: "totalsBlock", label: "Summen" },
  { type: "noteBlock", label: "Notiz" },
  { type: "footerBlock", label: "Fusszeile" },
  { type: "customText", label: "Freitext" },
];

const ELEMENT_LABELS = new Map(
  ELEMENT_PALETTE.map((item) => [item.type, item.label]),
);

const createElement = (type: PurchaseOrderDesignerElement["type"]): PurchaseOrderDesignerElement => {
  const base: PurchaseOrderDesignerElement = {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    x: 40,
    y: 40,
    w: 240,
    h: 60,
    fontSize: 10,
    align: "left",
  };

  switch (type) {
    case "companyName":
      return { ...base, w: 320, h: 40, fontSize: 18 };
    case "companyDetails":
      return { ...base, w: 320, h: 90, fontSize: 10 };
    case "companyLogo":
      return { ...base, w: 180, h: 60 };
    case "orderMeta":
      return { ...base, w: 220, h: 70, align: "right" };
    case "supplierBlock":
      return { ...base, w: 320, h: 140, fontSize: 10 };
    case "linesTable":
      return { ...base, w: 680, h: 240 };
    case "totalsBlock":
      return { ...base, w: 260, h: 50, align: "right" };
    case "noteBlock":
      return { ...base, w: 420, h: 60 };
    case "footerBlock":
      return { ...base, w: 520, h: 40, fontSize: 9, align: "center" };
    case "customText":
      return { ...base, w: 200, h: 40, content: "Text hier" };
    default:
      return base;
  }
};

const renderElementPreview = (element: PurchaseOrderDesignerElement) => {
  const textStyle: React.CSSProperties = {
    fontSize: element.fontSize ?? 10,
    textAlign: element.align ?? "left",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  };

  switch (element.type) {
    case "companyName":
      return <div style={{ ...textStyle, fontWeight: 600 }}>{SAMPLE_DATA.companyName}</div>;
    case "companyDetails":
      return (
        <div style={textStyle}>
          <div>{SAMPLE_DATA.companyAddressLine1}</div>
          <div>{SAMPLE_DATA.companyAddressLine2}</div>
          <div>
            {SAMPLE_DATA.companyPostalCode} {SAMPLE_DATA.companyCity}
          </div>
          <div>{SAMPLE_DATA.companyCountry}</div>
          <div>Telefon: {SAMPLE_DATA.companyPhone}</div>
          <div>E-Mail: {SAMPLE_DATA.companyEmail}</div>
        </div>
      );
    case "companyLogo":
      return (
        <Box
          component="img"
          src={SAMPLE_DATA.companyLogo}
          alt="Logo"
          sx={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      );
    case "orderMeta":
      return (
        <div style={textStyle}>
          <div>Bestellnr.: {SAMPLE_DATA.orderNumber}</div>
          <div>Datum: {SAMPLE_DATA.orderDate}</div>
          <div>Status: {SAMPLE_DATA.orderStatus}</div>
        </div>
      );
    case "supplierBlock":
      return (
        <div style={textStyle}>
          <div style={{ fontWeight: 600 }}>{SAMPLE_DATA.supplierName}</div>
          <div>{SAMPLE_DATA.supplierAddressLine1}</div>
          <div>{SAMPLE_DATA.supplierAddressLine2}</div>
          <div>
            {SAMPLE_DATA.supplierPostalCode} {SAMPLE_DATA.supplierCity}
          </div>
          <div>{SAMPLE_DATA.supplierCountry}</div>
          <div>Kontakt: {SAMPLE_DATA.supplierContactName}</div>
          <div>E-Mail: {SAMPLE_DATA.supplierEmail}</div>
          <div>Telefon: {SAMPLE_DATA.supplierPhone}</div>
          <div>Kundennr.: {SAMPLE_DATA.supplierCustomerNumber}</div>
        </div>
      );
    case "linesTable":
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Artikel</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Menge</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Offen</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_DATA.lines.map((line) => (
              <tr key={line.lineIndex}>
                <td style={{ borderBottom: "1px solid #eee" }}>
                  {line.itemCode} {line.itemDescription}
                </td>
                <td style={{ textAlign: "right", borderBottom: "1px solid #eee" }}>{line.quantity}</td>
                <td style={{ textAlign: "right", borderBottom: "1px solid #eee" }}>{line.remainingQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "totalsBlock":
      return (
        <div style={textStyle}>
          <div>Gesamt: {SAMPLE_DATA.totalQuantity}</div>
          <div>Geliefert: {SAMPLE_DATA.totalReceived}</div>
          <div>Offen: {SAMPLE_DATA.totalRemaining}</div>
        </div>
      );
    case "noteBlock":
      return (
        <div style={textStyle}>
          <div style={{ fontWeight: 600 }}>Notiz</div>
          <div>{SAMPLE_DATA.note}</div>
        </div>
      );
    case "footerBlock":
      return (
        <div style={textStyle}>
          {SAMPLE_DATA.companyName} · {SAMPLE_DATA.companyAddressLine1},{" "}
          {SAMPLE_DATA.companyPostalCode} {SAMPLE_DATA.companyCity} · Telefon:{" "}
          {SAMPLE_DATA.companyPhone} · {SAMPLE_DATA.companyEmail}
        </div>
      );
    case "customText":
      return <div style={textStyle}>{element.content ?? "Text"}</div>;
    default:
      return null;
  }
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildTemplate = (config: PurchaseOrderDesignerConfig): PdfHtmlTemplate => {
  const page = config.page;
  const pageCss = `
@page {
  size: A4 ${page.orientation};
  margin: 0;
}
body {
  font-family: "Helvetica", "Arial", sans-serif;
  font-size: 10pt;
  color: #222;
}
.page {
  position: relative;
  width: ${page.width}px;
  min-height: ${page.height}px;
}
.element {
  position: absolute;
  box-sizing: border-box;
}
.element img {
  max-width: 100%;
  max-height: 100%;
}
.lines-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
}
.lines-table th,
.lines-table td {
  border-bottom: 1px solid #ddd;
  padding: 6px 4px;
}
`;

  const elementHtml = config.elements
    .map((element) => {
      const styleParts = [
        `left:${element.x}px; top:${element.y}px; width:${element.w}px; min-height:${element.h}px;`,
        element.fontSize ? `font-size:${element.fontSize}px;` : "",
        element.align ? `text-align:${element.align};` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const baseClass = element.type === "linesTable" ? "element lines-table" : "element";

      const wrap = (inner: string) => `<div class="${baseClass}" style="${styleParts}">${inner}</div>`;

      switch (element.type) {
        case "companyName":
          return wrap(`<div style="font-weight:600;">{{companyName}}</div>`);
        case "companyDetails":
          return wrap(`
            {{#companyAddressLine1}}<div>{{companyAddressLine1}}</div>{{/companyAddressLine1}}
            {{#companyAddressLine2}}<div>{{companyAddressLine2}}</div>{{/companyAddressLine2}}
            {{#companyCityLine}}<div>{{companyCityLine}}</div>{{/companyCityLine}}
            {{#companyCountry}}<div>{{companyCountry}}</div>{{/companyCountry}}
            {{#companyPhone}}<div>Telefon: {{companyPhone}}</div>{{/companyPhone}}
            {{#companyEmail}}<div>E-Mail: {{companyEmail}}</div>{{/companyEmail}}
          `);
        case "companyLogo":
          return wrap(`{{#companyLogo}}<img src="{{companyLogo}}" alt="Logo" />{{/companyLogo}}`);
        case "orderMeta":
          return wrap(`
            <div>Bestellnr.: {{orderNumber}}</div>
            <div>Datum: {{orderDate}}</div>
            <div>Status: {{orderStatus}}</div>
          `);
        case "supplierBlock":
          return wrap(`
            <div style="font-weight:600;">{{supplierName}}</div>
            {{#supplierAddressLine1}}<div>{{supplierAddressLine1}}</div>{{/supplierAddressLine1}}
            {{#supplierAddressLine2}}<div>{{supplierAddressLine2}}</div>{{/supplierAddressLine2}}
            {{#supplierCity}}<div>{{supplierPostalCode}} {{supplierCity}}</div>{{/supplierCity}}
            {{#supplierCountry}}<div>{{supplierCountry}}</div>{{/supplierCountry}}
            {{#supplierContactName}}<div>Kontakt: {{supplierContactName}}</div>{{/supplierContactName}}
            {{#supplierEmail}}<div>E-Mail: {{supplierEmail}}</div>{{/supplierEmail}}
            {{#supplierPhone}}<div>Telefon: {{supplierPhone}}</div>{{/supplierPhone}}
            {{#supplierCustomerNumber}}<div>Kundennr.: {{supplierCustomerNumber}}</div>{{/supplierCustomerNumber}}
          `);
        case "linesTable":
          return wrap(`
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Artikel</th>
                  <th>Beschreibung</th>
                  <th style="text-align:right;">Menge</th>
                  <th style="text-align:right;">VE</th>
                  <th style="text-align:right;">Geliefert</th>
                  <th style="text-align:right;">Offen</th>
                </tr>
              </thead>
              <tbody>
                {{#lines}}
                <tr>
                  <td>{{lineIndex}}</td>
                  <td>{{itemCode}}</td>
                  <td>{{itemDescription}}</td>
                  <td style="text-align:right;">{{quantity}}</td>
                  <td style="text-align:right;">{{#packSize}}{{packSize}}{{/packSize}}{{^packSize}}-{{/packSize}}</td>
                  <td style="text-align:right;">{{receivedQuantity}}</td>
                  <td style="text-align:right;">{{remainingQuantity}}</td>
                </tr>
                {{/lines}}
              </tbody>
            </table>
          `);
        case "totalsBlock":
          return wrap(`
            <div>Gesamtmenge: {{totalQuantity}}</div>
            <div>Geliefert: {{totalReceived}}</div>
            <div>Offen: {{totalRemaining}}</div>
          `);
        case "noteBlock":
          return wrap(`
            {{#note}}
            <div style="font-weight:600;">Notiz</div>
            <div>{{note}}</div>
            {{/note}}
          `);
        case "footerBlock":
          return wrap(`
            {{companyName}} · {{companyAddressLine1}} · {{companyPostalCode}} {{companyCity}} · Telefon: {{companyPhone}} · {{companyEmail}}
          `);
        case "customText": {
          const content = escapeHtml(element.content ?? "").replace(/\n/g, "<br />");
          return wrap(`<div>${content}</div>`);
        }
        default:
          return "";
      }
    })
    .join("\n");

  return {
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bestellung</title>
</head>
<body>
  <div class="page">
${elementHtml}
  </div>
</body>
</html>`,
    css: pageCss,
  };
};

const PurchaseOrderTemplatePage: React.FC = () => {
  const [config, setConfig] = useState<PurchaseOrderDesignerConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadDesigner();
  }, []);

  const loadDesigner = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPurchaseOrderPdfDesigner();
      setConfig(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Designer konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  const updateElement = (id: string, updater: (el: PurchaseOrderDesignerElement) => PurchaseOrderDesignerElement) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: prev.elements.map((el) => (el.id === id ? updater(el) : el)),
      };
    });
  };

  const selectedElement = useMemo(
    () => config?.elements.find((el) => el.id === selectedId) ?? null,
    [config, selectedId],
  );

  const handleAddElement = (type: PurchaseOrderDesignerElement["type"]) => {
    if (!config) return;
    const element = createElement(type);
    setConfig({ ...config, elements: [...config.elements, element] });
    setSelectedId(element.id);
  };

  const handleDeleteElement = () => {
    if (!config || !selectedId) return;
    setConfig({
      ...config,
      elements: config.elements.filter((el) => el.id !== selectedId),
    });
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const template = buildTemplate(config);
      await updatePurchaseOrderPdfDesigner(config);
      await updatePurchaseOrderPdfTemplate(template);
      setSuccess("Designer gespeichert. Das Bestell-PDF nutzt jetzt dieses Layout.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleOrientation = (value: "portrait" | "landscape") => {
    if (!config) return;
    const size = PAGE_SIZES[value];
    setConfig({
      ...config,
      page: { width: size.width, height: size.height, orientation: value },
    });
  };

  if (loading || !config) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  const pageStyle = {
    width: config.page.width,
    height: config.page.height,
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bestell-PDF Designer
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Ziehe Elemente frei auf die Seite, passe Größe und Position an und speichere.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Elemente
            </Typography>
            <Stack spacing={1}>
              {ELEMENT_PALETTE.map((item) => (
                <Button
                  key={item.type}
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => handleAddElement(item.type)}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              Seite
            </Typography>
            <TextField
              select
              label="Ausrichtung"
              size="small"
              fullWidth
              value={config.page.orientation}
              onChange={(event) => handleOrientation(event.target.value as "portrait" | "landscape")}
            >
              <MenuItem value="portrait">Hochformat</MenuItem>
              <MenuItem value="landscape">Querformat</MenuItem>
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Zoom</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ZoomOut />}
                  onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.1))}
                >
                  -
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ZoomIn />}
                  onClick={() => setZoom((prev) => Math.min(1.4, prev + 0.1))}
                >
                  +
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, overflow: "auto", bgcolor: "grey.100" }}>
            <Box
              sx={{
                position: "relative",
                margin: "0 auto",
                backgroundColor: "white",
                boxShadow: "0 0 8px rgba(0,0,0,0.15)",
                ...pageStyle,
              }}
            >
              {config.elements.map((element) => (
                <Rnd
                  key={element.id}
                  size={{ width: element.w, height: element.h }}
                  position={{ x: element.x, y: element.y }}
                  scale={zoom}
                  onDragStop={(_, data) =>
                    updateElement(element.id, (el) => ({ ...el, x: data.x, y: data.y }))
                  }
                  onResizeStop={(_, __, ref, ___, position) => {
                    updateElement(element.id, (el) => ({
                      ...el,
                      x: position.x,
                      y: position.y,
                      w: ref.offsetWidth,
                      h: ref.offsetHeight,
                    }));
                  }}
                  bounds="parent"
                  onClick={() => setSelectedId(element.id)}
                  style={{
                    border: selectedId === element.id ? "2px solid #1976d2" : "1px dashed #bbb",
                    padding: 4,
                    backgroundColor: "rgba(255,255,255,0.9)",
                    color: "#1b1b1b",
                  }}
                >
                  <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        px: 0.6,
                        py: 0.2,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#1565c0",
                        backgroundColor: "rgba(21,101,192,0.12)",
                        borderRadius: "0 0 4px 0",
                        pointerEvents: "none",
                        zIndex: 2,
                      }}
                    >
                      {ELEMENT_LABELS.get(element.type) ?? element.type}
                    </Box>
                    <Box sx={{ width: "100%", height: "100%", pt: 2 }}>
                      {renderElementPreview(element)}
                    </Box>
                  </Box>
                </Rnd>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Eigenschaften
            </Typography>
            {!selectedElement && (
              <Typography variant="body2" color="text.secondary">
                Wähle ein Element auf der Seite aus.
              </Typography>
            )}
            {selectedElement && (
              <Stack spacing={1}>
                <TextField
                  label="X"
                  size="small"
                  type="number"
                  value={selectedElement.x}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      x: Number(event.target.value),
                    }))
                  }
                />
                <TextField
                  label="Y"
                  size="small"
                  type="number"
                  value={selectedElement.y}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      y: Number(event.target.value),
                    }))
                  }
                />
                <TextField
                  label="Breite"
                  size="small"
                  type="number"
                  value={selectedElement.w}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      w: Number(event.target.value),
                    }))
                  }
                />
                <TextField
                  label="Höhe"
                  size="small"
                  type="number"
                  value={selectedElement.h}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      h: Number(event.target.value),
                    }))
                  }
                />
                <TextField
                  label="Schriftgröße"
                  size="small"
                  type="number"
                  value={selectedElement.fontSize ?? 10}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      fontSize: Number(event.target.value),
                    }))
                  }
                />
                <TextField
                  label="Ausrichtung"
                  size="small"
                  select
                  value={selectedElement.align ?? "left"}
                  onChange={(event) =>
                    updateElement(selectedElement.id, (el) => ({
                      ...el,
                      align: event.target.value as "left" | "center" | "right",
                    }))
                  }
                >
                  <MenuItem value="left">Links</MenuItem>
                  <MenuItem value="center">Zentriert</MenuItem>
                  <MenuItem value="right">Rechts</MenuItem>
                </TextField>
                {selectedElement.type === "customText" && (
                  <TextField
                    label="Text"
                    size="small"
                    multiline
                    minRows={3}
                    value={selectedElement.content ?? ""}
                    onChange={(event) =>
                      updateElement(selectedElement.id, (el) => ({
                        ...el,
                        content: event.target.value,
                      }))
                    }
                  />
                )}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleDeleteElement}
                >
                  Element löschen
                </Button>
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Aktionen
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Speichern..." : "Speichern"}
              </Button>
              <Button variant="outlined" startIcon={<Refresh />} onClick={loadDesigner}>
                Zurücksetzen
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Hinweis: Die Positions-Tabelle kann bei sehr langen Bestellungen über mehrere Seiten laufen.
          Bitte die Tabelle möglichst weit unten platzieren, damit nichts überlappt.
        </Typography>
      </Box>
    </Box>
  );
};

export default PurchaseOrderTemplatePage;

