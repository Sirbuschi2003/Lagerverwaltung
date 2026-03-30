import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  downloadPurchaseOrderDocument,
  fetchPurchaseOrderDocuments,
  type PurchaseOrderDocumentDto,
} from "../../utils/api";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const OrderDocumentsTab: React.FC = () => {
  const theme = useTheme();

  const [documents, setDocuments] = useState<PurchaseOrderDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchaseOrderDocuments();
      setDocuments(data);
    } catch (err: any) {
      setError(`Dokumente konnten nicht geladen werden: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach((entry) => {
      if (entry.supplierId) {
        map.set(entry.supplierId, entry.supplierName || "Unbekannt");
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [documents]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    documents.forEach((entry) => years.add(entry.year));
    return [...years].sort((a, b) => b - a);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((entry) => {
      if (supplierFilter !== "ALL" && entry.supplierId !== supplierFilter) return false;
      if (yearFilter !== "ALL" && entry.year !== Number.parseInt(yearFilter, 10)) return false;
      return true;
    });
  }, [documents, supplierFilter, yearFilter]);

  const handleDownload = async (doc: PurchaseOrderDocumentDto) => {
    setDownloading(doc.path);
    try {
      const blob = await downloadPurchaseOrderDocument(doc.year, doc.filename);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess(`Dokument ${doc.filename} heruntergeladen.`);
    } catch (err: any) {
      setError(`Download fehlgeschlagen: ${err?.response?.data?.message || err?.message || "Unbekannt"}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Box>
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

      <Paper
        sx={{
          mb: 2,
          p: 2,
          backgroundColor: alpha(theme.palette.background.paper, 0.88),
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Bestell-Dokumente ({filteredDocuments.length})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dateien aus dem Docker-Ordner `/app/purchase-orders/(jahr)/...`
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Lieferant</InputLabel>
              <Select
                value={supplierFilter}
                label="Lieferant"
                onChange={(event) => setSupplierFilter(event.target.value)}
              >
                <MenuItem value="ALL">Alle Lieferanten</MenuItem>
                {supplierOptions.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Jahr</InputLabel>
              <Select value={yearFilter} label="Jahr" onChange={(event) => setYearFilter(event.target.value)}>
                <MenuItem value="ALL">Alle</MenuItem>
                {yearOptions.map((year) => (
                  <MenuItem key={year} value={String(year)}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDocuments}>
              Aktualisieren
            </Button>
          </Box>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
          <CircularProgress />
        </Box>
      ) : filteredDocuments.length === 0 ? (
        <Alert severity="info">Keine Dokumente im Bestellarchiv gefunden.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Jahr</TableCell>
                <TableCell>Datei</TableCell>
                <TableCell>Lieferant</TableCell>
                <TableCell align="right">Größe</TableCell>
                <TableCell align="right">Erstellt</TableCell>
                <TableCell align="right">Aktion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.path} hover>
                  <TableCell>{doc.year}</TableCell>
                  <TableCell>{doc.filename}</TableCell>
                  <TableCell>{doc.supplierName || "-"}</TableCell>
                  <TableCell align="right">{formatBytes(doc.size)}</TableCell>
                  <TableCell align="right">{new Date(doc.created).toLocaleString("de-DE")}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleDownload(doc)}
                          disabled={downloading === doc.path}
                        >
                          {downloading === doc.path ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default OrderDocumentsTab;

