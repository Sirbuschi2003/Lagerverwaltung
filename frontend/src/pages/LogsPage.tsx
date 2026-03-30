import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Grid,
  TextField,
  Stack,
  Snackbar,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import {
  getLogs,
  downloadLogsCSV,
  downloadLogsJSON,
  getLogStats,
  getLogRetention,
  setLogRetention,
  deleteAllLogs,
  cleanupOldLogs,
  type LogFilters,
  type LogEntry,
  type LogStats,
} from '../utils/api';

const LogsPage: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState<LogFilters>({
    limit: 50,
    offset: 0,
  });
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showLogDetails, setShowLogDetails] = useState<LogEntry | null>(null);
  const [retentionDays, setRetentionDaysState] = useState<number>(90);
  const [savingRetention, setSavingRetention] = useState(false);
  const [busyDeleteAll, setBusyDeleteAll] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info'}>({ open: false, message: '', severity: 'info' });

  // Logs laden
  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await getLogs(logFilters);
      setLogs(response.logs);
      setTotalLogs(response.total);
    } catch (error) {
      console.error('Fehler beim Laden der Logs:', error);
    }
    setLogsLoading(false);
  };

  // Log-Statistiken laden
  const loadLogStats = async () => {
    try {
      const stats = await getLogStats();
      setLogStats(stats);
    } catch (error) {
      console.error('Fehler beim Laden der Log-Statistiken:', error);
    }
  };

  useEffect(() => {
    loadLogs();
    loadLogStats();
  }, [logFilters]);

  useEffect(() => {
    // Retention laden
    (async () => {
      try {
        const res = await getLogRetention();
        if (res && typeof res.retentionDays === 'number') {
          setRetentionDaysState(res.retentionDays);
        }
      } catch (e) {
        console.warn('Konnte Aufbewahrungsdauer nicht laden:', e);
      }
    })();
  }, []);

  // Logs herunterladen
  const handleDownloadLogs = async (format: 'csv' | 'json') => {
    try {
      let blob: Blob;
      let filename: string;
      
      if (format === 'csv') {
        blob = await downloadLogsCSV(logFilters);
        filename = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        blob = await downloadLogsJSON(logFilters);
        filename = `system-logs-${new Date().toISOString().slice(0, 10)}.json`;
      }

      // Download auslösen
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Fehler beim Herunterladen (${format}):`, error);
    }
  };

  // Seitennavigation
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    setLogFilters(prev => ({
      ...prev,
      offset: (page - 1) * (prev.limit || 50),
    }));
  };

  // Log-Level Farben
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'error';
      case 'WARNING': return 'warning';
      case 'SECURITY': return 'secondary';
      case 'INFO': 
      default: return 'default';
    }
  };

  const totalPages = Math.ceil(totalLogs / (logFilters.limit || 50));

  return (
    <Container maxWidth={isEmbedded ? "lg" : "xl"} sx={{ mt: isEmbedded ? 0 : 4, mb: 4 }}>
      {!isEmbedded && (
        <>
          <Typography variant="h4" gutterBottom>
            Systemprotokolle
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Überwachung aller Frontend- und Backend-Logs in Echtzeit. Filterbar nach Quelle, Level und Kategorie.
          </Typography>
        </>
      )}

      {/* Statistiken */}
      {logStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Gesamt
                </Typography>
                <Typography variant="h5">
                  {logStats.totalLogs?.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Fehler
                </Typography>
                <Typography variant="h5" color="error">
                  {logStats.byLevel?.ERROR || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Warnungen
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {logStats.byLevel?.WARNING || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Sicherheit
                </Typography>
                <Typography variant="h5" color="secondary">
                  {logStats.byLevel?.SECURITY || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        {/* Aufbewahrung & Bereinigung */}
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              type="number"
              size="small"
              label="Aufbewahrung (Tage)"
              value={retentionDays}
              onChange={(e) => setRetentionDaysState(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 3650 }}
            />
            <Button
              variant="contained"
              disabled={savingRetention}
              onClick={async () => {
                try {
                  setSavingRetention(true);
                  const res = await setLogRetention(retentionDays);
                  setSnackbar({ open: true, message: `Aufbewahrung gespeichert: ${res.retentionDays} Tage`, severity: 'success' });
                } catch (e) {
                  setSnackbar({ open: true, message: 'Fehler beim Speichern der Aufbewahrung', severity: 'error' });
                } finally {
                  setSavingRetention(false);
                }
              }}
            >
              Speichern
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  const res = await cleanupOldLogs(retentionDays);
                  setSnackbar({ open: true, message: `${res.deletedCount} alte Logs gelöscht (> ${res.daysToKeep} Tage)`, severity: 'success' });
                  await Promise.all([loadLogs(), loadLogStats()]);
                } catch (e) {
                  setSnackbar({ open: true, message: 'Fehler beim Bereinigen alter Logs', severity: 'error' });
                }
              }}
            >
              Alte Logs bereinigen
            </Button>
          </Stack>

          <Box>
            <Button
              variant="contained"
              color="error"
              disabled={busyDeleteAll}
              onClick={async () => {
                if (!window.confirm('Wirklich ALLE Logs löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
                try {
                  setBusyDeleteAll(true);
                  const res = await deleteAllLogs();
                  setSnackbar({ open: true, message: `Alle Logs gelöscht (${res.deletedCount})`, severity: 'success' });
                  await Promise.all([loadLogs(), loadLogStats()]);
                } catch (e) {
                  setSnackbar({ open: true, message: 'Fehler beim Löschen aller Logs', severity: 'error' });
                } finally {
                  setBusyDeleteAll(false);
                }
              }}
            >
              Alle Logs löschen
            </Button>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          {/* Filter */}
          <Box display="flex" gap={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Quelle</InputLabel>
              <Select
                value={logFilters.source || ''}
                label="Quelle"
                onChange={(e) => setLogFilters(prev => ({ ...prev, source: e.target.value || undefined, offset: 0 }))}
              >
                <MenuItem value="">Alle</MenuItem>
                <MenuItem value="FRONTEND">Frontend</MenuItem>
                <MenuItem value="BACKEND">Backend</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Level</InputLabel>
              <Select
                value={logFilters.level || ''}
                label="Level"
                onChange={(e) => setLogFilters(prev => ({ ...prev, level: e.target.value || undefined, offset: 0 }))}
              >
                <MenuItem value="">Alle</MenuItem>
                <MenuItem value="INFO">Info</MenuItem>
                <MenuItem value="WARNING">Warning</MenuItem>
                <MenuItem value="ERROR">Error</MenuItem>
                <MenuItem value="SECURITY">Security</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Kategorie</InputLabel>
              <Select
                value={logFilters.category || ''}
                label="Kategorie"
                onChange={(e) => setLogFilters(prev => ({ ...prev, category: e.target.value || undefined, offset: 0 }))}
              >
                <MenuItem value="">Alle</MenuItem>
                <MenuItem value="AUTH">Auth</MenuItem>
                <MenuItem value="STOCK">Stock</MenuItem>
                <MenuItem value="INVENTORY">Inventory</MenuItem>
                <MenuItem value="SYSTEM">System</MenuItem>
                <MenuItem value="API">API</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Limit</InputLabel>
              <Select
                value={logFilters.limit || 50}
                label="Limit"
                onChange={(e) => setLogFilters(prev => ({ ...prev, limit: Number(e.target.value), offset: 0 }))}
              >
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Aktionen */}
          <Box display="flex" gap={1}>
            <Tooltip title="Logs neu laden">
              <IconButton onClick={loadLogs} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownloadLogs('csv')}
            >
              CSV
            </Button>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownloadLogs('json')}
            >
              JSON
            </Button>
          </Box>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        message={snackbar.message}
      />

      {/* Log-Tabelle */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Zeitstempel</TableCell>
                <TableCell>Quelle</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Kategorie</TableCell>
                <TableCell>Nachricht</TableCell>
                <TableCell>Benutzer</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Keine Logs gefunden
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.source || 'N/A'} 
                        size="small" 
                        color={log.source === 'BACKEND' ? 'primary' : 'info'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.level} 
                        size="small" 
                        color={getLogLevelColor(log.level) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 400 }}>
                      <Typography variant="body2" noWrap>
                        {log.action || log.message || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{log.username || '-'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Details anzeigen">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowLogDetails(log)}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination 
              count={totalPages} 
              page={currentPage} 
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Log-Details Dialog */}
      <Dialog
        open={!!showLogDetails}
        onClose={() => setShowLogDetails(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Log-Details</DialogTitle>
        <DialogContent>
          {showLogDetails && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>ID:</strong> {showLogDetails.id}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Zeitstempel:</strong> {new Date(showLogDetails.timestamp).toLocaleString('de-DE')}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Quelle:</strong> {showLogDetails.source || '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Level:</strong> {showLogDetails.level}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Kategorie:</strong> {showLogDetails.category}
              </Typography>
              {showLogDetails.username && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Benutzer:</strong> {showLogDetails.username}
                </Typography>
              )}
              {showLogDetails.userId && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Benutzer-ID:</strong> {showLogDetails.userId}
                </Typography>
              )}
              {showLogDetails.ipAddress && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>IP-Adresse:</strong> {showLogDetails.ipAddress}
                </Typography>
              )}
              {showLogDetails.userAgent && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>User Agent:</strong> {showLogDetails.userAgent}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                <strong>Nachricht:</strong>
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {showLogDetails.action || showLogDetails.message || '-'}
                </Typography>
              </Paper>
              {showLogDetails.details && (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    <strong>Details:</strong>
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {JSON.stringify(showLogDetails.details, null, 2)}
                    </Typography>
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogDetails(null)}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LogsPage;
