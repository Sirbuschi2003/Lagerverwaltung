import React, { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Alert,
  Grid,
  Chip,
  Tooltip,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import StorageIcon from "@mui/icons-material/Storage";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { fetchArchives, downloadArchive, downloadArchiveZip, getArchiveStats, updateArchiveRetention, forceArchiveNow } from "../utils/api";
import useAuthStore from "../store/useAuthStore";

interface ArchiveData {
  date: string;
  categories: {
    category: string;
    count: number;
    size: number;
  }[];
}

interface ArchiveStats {
  totalArchives: number;
  oldestDate: string;
  newestDate: string;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
  retentionDays: number;
  lastCleanupDate?: string;
}

const ArchiveManagementPage: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const user = useAuthStore((state: any) => state.user);
  const [archives, setArchives] = useState<ArchiveData[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);
  const [selectedArchives, setSelectedArchives] = useState<string[]>([]);
  const [openRetentionDialog, setOpenRetentionDialog] = useState(false);
  const [newRetentionDays, setNewRetentionDays] = useState(30);
  const [downloading, setDownloading] = useState(false);

  // Archiv-Daten laden
  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    try {
      setLoading(true);
      const [archivesResponse, statsResponse] = await Promise.all([
        fetchArchives(),
        getArchiveStats(),
      ]);

      // Gruppiere die flachen Archive-Daten nach Datum
      const groupedArchives: Record<string, ArchiveData> = {};
      
      (archivesResponse || []).forEach((archive: any) => {
        if (!groupedArchives[archive.date]) {
          groupedArchives[archive.date] = {
            date: archive.date,
            categories: []
          };
        }
        groupedArchives[archive.date].categories.push({
          category: archive.category,
          count: archive.entryCount || 0,
          size: archive.size || 0
        });
      });

      const groupedArray = Object.values(groupedArchives).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setArchives(groupedArray);
      if (statsResponse) {
        setStats(statsResponse);
        setRetentionDays(statsResponse.retentionDays || 30);
        setNewRetentionDays(statsResponse.retentionDays || 30);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Archive:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArchive = (date: string) => {
    setSelectedArchives((prev) =>
      prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArchives(archives.map((a) => a.date));
    } else {
      setSelectedArchives([]);
    }
  };

  const handleDownloadSingle = async (date: string, category: string) => {
    try {
      setDownloading(true);
      await downloadArchive(date, category);
    } catch (error) {
      console.error("Fehler beim Download:", error);
      alert("Download fehlgeschlagen");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (selectedArchives.length === 0) {
      alert("Bitte mindestens ein Datum auswählen");
      return;
    }

    try {
      setDownloading(true);
      await downloadArchiveZip(selectedArchives);
    } catch (error) {
      console.error("Fehler beim ZIP-Download:", error);
      alert("ZIP-Download fehlgeschlagen");
    } finally {
      setDownloading(false);
    }
  };

  const handleRetentionChange = async () => {
    try {
      await updateArchiveRetention(newRetentionDays);
      setRetentionDays(newRetentionDays);
      setOpenRetentionDialog(false);
      alert("Aufbewahrungsdauer aktualisiert");
      loadArchives();
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Aufbewahrungsdauer:", error);
      alert("Fehler beim Aktualisieren");
    }
  };

  const handleForceArchive = async () => {
    try {
      setDownloading(true);
      const today = new Date().toISOString().split('T')[0];
      const result = await forceArchiveNow(today);
      alert(`Archivierung erfolgreich: ${result.byCategory ? Object.values(result.byCategory).reduce((sum: number, cat: any) => sum + cat, 0) : 0} Logs archiviert`);
      loadArchives();
    } catch (error) {
      console.error("Fehler beim Archivieren:", error);
      alert("Archivierung fehlgeschlagen");
    } finally {
      setDownloading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const categoryColors: Record<string, "success" | "info" | "warning" | "error" | "default"> = {
    STOCK: "success",
    SYSTEM: "info",
    ERROR: "error",
    AUTH: "warning",
    INVENTORY: "default",
    API: "info",
  };

  return (
    <Container maxWidth={isEmbedded ? "lg" : "lg"} sx={{ py: isEmbedded ? 0 : 4 }}>
      {!isEmbedded && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold" }}>
            📦 Protokoll-Archiv
          </Typography>
          <Typography color="textSecondary">
            Tägliche Log-Archive mit konfigurierbarer Aufbewahrungsdauer
          </Typography>
        </Box>
      )}

      {/* Statistik-Karten */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <FolderOpenIcon color="primary" />
                  <Typography color="textSecondary" variant="caption">
                    Archive
                  </Typography>
                </Box>
                <Typography variant="h5">{stats.totalArchives}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <StorageIcon color="primary" />
                  <Typography color="textSecondary" variant="caption">
                    Größe
                  </Typography>
                </Box>
                <Typography variant="h5">{formatBytes(stats.totalSize)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <DateRangeIcon color="primary" />
                  <Typography color="textSecondary" variant="caption">
                    Zeitraum
                  </Typography>
                </Box>
                <Typography variant="body2">
                  {stats.oldestDate} bis {stats.newestDate}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <RefreshIcon color="primary" />
                  <Typography color="textSecondary" variant="caption">
                    Aufbewahrung
                  </Typography>
                </Box>
                <Typography variant="h5">{stats.retentionDays} Tage</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Konfiguration & Aktionen */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadArchives}
            disabled={loading}
          >
            Aktualisieren
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            onClick={handleForceArchive}
            disabled={downloading}
          >
            Jetzt archivieren
          </Button>
          <Button
            variant="outlined"
            onClick={() => setOpenRetentionDialog(true)}
          >
            Aufbewahrung ändern ({retentionDays} Tage)
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => handleDownloadZip()}
            disabled={selectedArchives.length === 0 || downloading}
          >
            ZIP herunterladen ({selectedArchives.length})
          </Button>
          <Alert severity="info" sx={{ flex: 1 }}>
            Alte Archive werden automatisch nach {retentionDays} Tagen gelöscht
          </Alert>
        </Box>
      </Paper>

      {/* Archive Tabelle */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : archives.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="textSecondary">Keine Archive vorhanden</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedArchives.length > 0 &&
                      selectedArchives.length < archives.length
                    }
                    checked={
                      archives.length > 0 &&
                      selectedArchives.length === archives.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Datum</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Kategorien</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Größe
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Aktionen
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {archives.map((archive) => (
                <TableRow key={archive.date} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedArchives.includes(archive.date)}
                      onChange={() => handleSelectArchive(archive.date)}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {new Date(archive.date).toLocaleDateString("de-DE", {
                      weekday: "short",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {archive.categories && archive.categories.length > 0 ? (
                        archive.categories.map((cat) => (
                          <Chip
                            key={cat.category}
                            label={`${cat.category} (${cat.count})`}
                            size="small"
                            color={categoryColors[cat.category] || "default"}
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">Keine Kategorien</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {formatBytes(
                      (archive.categories || []).reduce((sum, cat) => sum + cat.size, 0)
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Alle dieser Kategorien herunterladen">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        {(archive.categories || []).map((cat) => (
                          <Tooltip
                            key={cat.category}
                            title={`${cat.category}: ${cat.count} Logs`}
                          >
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<DownloadIcon />}
                              onClick={() =>
                                handleDownloadSingle(archive.date, cat.category)
                              }
                              disabled={downloading}
                              sx={{
                                whiteSpace: "nowrap",
                                minWidth: "auto",
                                fontSize: "0.75rem",
                              }}
                            >
                              {cat.category}
                            </Button>
                          </Tooltip>
                        ))}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Dialog: Aufbewahrungsdauer ändern */}
      <Dialog open={openRetentionDialog} onClose={() => setOpenRetentionDialog(false)}>
        <DialogTitle>Aufbewahrungsdauer ändern</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            type="number"
            label="Tage"
            value={newRetentionDays}
            onChange={(e) => setNewRetentionDays(parseInt(e.target.value) || 30)}
            fullWidth
            inputProps={{ min: 1, max: 3650 }}
            helperText="Archive älter als diese Anzahl von Tagen werden automatisch gelöscht"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRetentionDialog(false)}>Abbrechen</Button>
          <Button onClick={handleRetentionChange} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>


    </Container>
  );
};

export default ArchiveManagementPage;
