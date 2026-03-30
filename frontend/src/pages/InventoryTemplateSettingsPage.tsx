import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import {
  deleteInventoryTemplate,
  downloadInventoryTemplate,
  fetchInventoryTemplateMeta,
  type InventoryTemplateMeta,
  type InventoryTemplatePlaceholderGroup,
  uploadInventoryTemplate,
} from "../utils/api";

const formatBytes = (value?: number) => {
  if (!value || value <= 0) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const InventoryTemplateSettingsPage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta] = useState<InventoryTemplateMeta | null>(null);
  const [placeholders, setPlaceholders] = useState<InventoryTemplatePlaceholderGroup[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchInventoryTemplateMeta();
      setMeta(response.meta ?? null);
      setPlaceholders(response.placeholders ?? []);
      setMessage(null);
    } catch (error) {
      console.error("Inventurvorlage konnte nicht geladen werden:", error);
      setMessage({ type: "error", text: "Vorlageninformationen konnten nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const metaResponse = await uploadInventoryTemplate(file);
      setMeta(metaResponse);
      setMessage({ type: "success", text: "Vorlage wurde gespeichert." });
    } catch (error) {
      console.error("Upload fehlgeschlagen:", error);
      setMessage({ type: "error", text: "Upload fehlgeschlagen. Bitte prüfe das XLSX-Format." });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!meta) {
      return;
    }
    try {
      const blob = await downloadInventoryTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = meta.filename || "inventur_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download fehlgeschlagen:", error);
      setMessage({ type: "error", text: "Vorlage konnte nicht heruntergeladen werden." });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Vorlage wirklich entfernen?")) {
      return;
    }
    setDeleting(true);
    try {
      await deleteInventoryTemplate();
      setMeta(null);
      setMessage({ type: "success", text: "Vorlage wurde entfernt." });
    } catch (error) {
      console.error("Vorlage konnte nicht gelöscht werden:", error);
      setMessage({ type: "error", text: "Vorlage konnte nicht gelöscht werden." });
    } finally {
      setDeleting(false);
    }
  };

  const placeholderCount = useMemo(
    () => placeholders.reduce((sum, group) => sum + group.placeholders.length, 0),
    [placeholders],
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Inventur-Vorlage
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Lade eine individuelle Excel-Vorlage hoch und verwende Platzhalter, um fertige Inventurberichte als XLSX abzurufen.
            Die Vorlage wird beim Export direkt mit den gezählten Positionen gefüllt und kann anschließend aus der Inventur-Ansicht als Excel oder PDF
            heruntergeladen werden.
          </Typography>
        </Box>

        {message && (
          <Alert severity={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Box>
                <Typography variant="h6">Aktive Vorlage</Typography>
                {meta ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>Datei:</strong> {meta.filename}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Größe:</strong> {formatBytes(meta.size)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Hochgeladen:</strong>{" "}
                      {new Date(meta.uploadedAt).toLocaleString("de-DE")}
                    </Typography>
                    {meta.uploadedBy && (
                      <Typography variant="body2">
                        <strong>Von:</strong> {meta.uploadedBy}
                      </Typography>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Noch keine Vorlage hinterlegt.
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={meta ? "Aktiv" : "Fehlt"} color={meta ? "success" : "default"} />
                <Chip label={`${placeholderCount} Platzhalter`} icon={<InfoOutlinedIcon fontSize="small" />} />
              </Stack>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<CloudDownloadIcon />}
                onClick={handleDownload}
                disabled={!meta}
              >
                Vorlage herunterladen
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={!meta || deleting}
              >
                {deleting ? "Wird entfernt..." : "Vorlage löschen"}
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={handleUploadClick}
                disabled={uploading}
              >
                {uploading ? "Upload läuft..." : "Neue Vorlage hochladen"}
              </Button>
            </Stack>

            <Alert severity="info">
              Markiere genau eine Tabellenzeile mit <code>{`{{line.*}}`}</code>-Platzhaltern - sie wird für jede erfasste
              Position dupliziert. Überschriften und Summen kannst du frei anordnen.
            </Alert>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Vorgehensweise
          </Typography>
          <Stack spacing={1} component="ol" sx={{ pl: 3, "& li": { mb: 0.5 } }}>
            <li>Excel-Vorlage gestalten (Logo, Kopfbereich, Summen etc.).</li>
            <li>
              Eine Tabellenzeile mit den gewünschten Spalten erstellen und dort die <code>{`{{line.*}}`}</code>-Platzhalter einsetzen.
            </li>
            <li>Optional weitere Platzhalter (siehe unten) im Kopf- oder Fußbereich verwenden.</li>
            <li>Vorlage hier hochladen und anschließend in der Inventur-Ansicht den Export als XLSX nutzen.</li>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Platzhalter-Legende
          </Typography>
          {placeholders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Keine Platzhalterinformationen gefunden.
            </Typography>
          )}
          <Stack spacing={3}>
            {placeholders.map((group) => (
              <Box key={group.category}>
                <Typography variant="subtitle1" gutterBottom>
                  {group.category}
                </Typography>
                {group.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {group.description}
                  </Typography>
                )}
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Platzhalter</TableCell>
                      <TableCell>Beschreibung</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.placeholders.map((placeholder) => (
                      <TableRow key={placeholder.token}>
                        <TableCell sx={{ fontFamily: "monospace" }}>{placeholder.token}</TableCell>
                        <TableCell>{placeholder.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Export aus der Inventur
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Öffne die Inventur-Ansicht und verwende dort den neuen Excel-Export-Button. Es wird automatisch die hier hinterlegte Vorlage
            verwendet. Der PDF-Export bleibt parallel verfügbar und nutzt weiterhin das Standardlayout.
          </Typography>
        </Paper>
      </Stack>

      <input
        hidden
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </Container>
  );
};

export default InventoryTemplateSettingsPage;
