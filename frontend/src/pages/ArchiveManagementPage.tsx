import React, { useEffect, useState, useMemo } from "react";
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
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Stack,
  Tooltip,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import StorageIcon from "@mui/icons-material/Storage";
import DateRangeIcon from "@mui/icons-material/DateRange";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { fetchArchives, downloadArchive, downloadArchiveZip, getArchiveStats, updateArchiveRetention, forceArchiveNow, getArchiveDayEntries, type LogEntry } from "../utils/api";
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

  // Viewer-State
  const [viewerDate, setViewerDate] = useState<string | null>(null);
  const [viewerEntries, setViewerEntries] = useState<LogEntry[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerCategory, setViewerCategory] = useState("");

  const viewerFiltered = useMemo(() => {
    let result = viewerEntries;
    if (viewerCategory) result = result.filter(e => e.category === viewerCategory);
    if (viewerSearch.trim()) {
      const q = viewerSearch.toLowerCase();
      result = result.filter(e =>
        (e.action || "").toLowerCase().includes(q) ||
        (e.username || "").toLowerCase().includes(q) ||
        (e.details || "").toLowerCase().includes(q) ||
        JSON.stringify(e.metadata || {}).toLowerCase().includes(q),
      );
    }
    return result;
  }, [viewerEntries, viewerSearch, viewerCategory]);

  const viewerCategories = useMemo(
    () => [...new Set(viewerEntries.map(e => e.category))].sort(),
    [viewerEntries],
  );

  const openViewer = async (date: string) => {
    setViewerDate(date);
    setViewerSearch("");
    setViewerCategory("");
    setViewerLoading(true);
    try {
      const res = await getArchiveDayEntries(date);
      setViewerEntries(res.entries);
    } catch {
      setViewerEntries([]);
    } finally {
      setViewerLoading(false);
    }
  };

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
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Größe</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Aktionen</TableCell>
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
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<VisibilityIcon />}
                        onClick={() => openViewer(archive.date)}
                      >
                        Ansehen
                      </Button>
                      {(archive.categories || []).map((cat) => (
                        <Tooltip key={cat.category} title={`${cat.category}: ${cat.count} Logs herunterladen`}>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<DownloadIcon />}
                            onClick={() => handleDownloadSingle(archive.date, cat.category)}
                            disabled={downloading}
                            sx={{ whiteSpace: "nowrap", minWidth: "auto", fontSize: "0.75rem" }}
                          >
                            {cat.category}
                          </Button>
                        </Tooltip>
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Dialog: Archiv-Viewer */}
      <Dialog
        open={!!viewerDate}
        onClose={() => setViewerDate(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: "85vh" } }}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h6">
              Archiv {viewerDate ? new Date(viewerDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {viewerFiltered.length} / {viewerEntries.length} Einträge
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
          {/* Filter-Leiste */}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", flexShrink: 0 }}>
            <TextField
              size="small"
              placeholder="Suchen (Aktion, Benutzer, Details…)"
              value={viewerSearch}
              onChange={(e) => setViewerSearch(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip
                label="Alle"
                size="small"
                onClick={() => setViewerCategory("")}
                color={viewerCategory === "" ? "primary" : "default"}
                variant={viewerCategory === "" ? "filled" : "outlined"}
                sx={{ cursor: "pointer" }}
              />
              {viewerCategories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  onClick={() => setViewerCategory(c => c === cat ? "" : cat)}
                  color={viewerCategory === cat ? "primary" : "default"}
                  variant={viewerCategory === cat ? "filled" : "outlined"}
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Stack>
          </Box>

          {/* Log-Liste */}
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            {viewerLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
              </Box>
            ) : viewerFiltered.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="text.secondary">Keine Einträge gefunden</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {viewerFiltered.map((entry, idx) => (
                  <React.Fragment key={entry.id ?? idx}>
                    <ListItem alignItems="flex-start" sx={{ px: 2, py: 1 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                            <Chip label={entry.category} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
                            {entry.level === "ERROR" && <Chip label="Fehler" size="small" color="error" sx={{ height: 20, fontSize: "0.7rem" }} />}
                            {entry.level === "WARNING" && <Chip label="Warnung" size="small" color="warning" sx={{ height: 20, fontSize: "0.7rem" }} />}
                            {entry.level === "SECURITY" && <Chip label="Sicherheit" size="small" color="secondary" sx={{ height: 20, fontSize: "0.7rem" }} />}
                            <Typography variant="body2" fontWeight={500}>{entry.action}</Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            {entry.details && (
                              <Typography variant="caption" color="text.secondary" display="block">{entry.details}</Typography>
                            )}
                            <Typography variant="caption" color="text.disabled">
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                              {entry.username ? ` · ${entry.username}` : ""}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {idx < viewerFiltered.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewerDate(null)}>Schließen</Button>
        </DialogActions>
      </Dialog>

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
