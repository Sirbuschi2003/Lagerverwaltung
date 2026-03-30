import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TextField,
  Typography,
  Tooltip,
  Stack,
  SelectChangeEvent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import useFrontendLogStore, { FrontendLogEntry } from '../store/useFrontendLogStore';
import { fetchSystemLogs } from '../utils/api';

interface BackendLog {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  message: string;
  user?: { displayName: string; id: string };
  details?: any;
}

const LiveLogsPage = () => {
  // Frontend-Logs
  const [frontendLogs, setFrontendLogs] = useState<FrontendLogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<BackendLog[]>([]);
  const [logSource, setLogSource] = useState<'all' | 'frontend' | 'backend'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const getLogs = useFrontendLogStore((state) => state.getLogs);
  const clearLogs = useFrontendLogStore((state) => state.clearLogs);
  const exportLogs = useFrontendLogStore((state) => state.exportLogs);

  // Logs laden (nur letzte 24 Stunden für Live-Ansicht)
  const loadAllLogs = async () => {
    try {
      setError(null);
      
      // Frontend-Logs laden
      if (logSource === 'all' || logSource === 'frontend') {
        const feLogs = await getLogs();
        setFrontendLogs(feLogs);
      }
      
      // Backend-Logs laden
      if (logSource === 'all' || logSource === 'backend') {
        try {
          const beLogs = await fetchSystemLogs({ limit: 500 });
          const validLogs = Array.isArray(beLogs) ? beLogs : [];
          
          // Filter Backend-Logs: Nur gültige Timestamps
          const recentBeLogs = validLogs.filter(log => {
            if (!log.timestamp) return false;
            const logDate = new Date(log.timestamp);
            // Prüfe ob Datum gültig ist (kein "Invalid Date")
            return !isNaN(logDate.getTime());
          });
          
          setBackendLogs(recentBeLogs);
        } catch (err: any) {
          console.warn('[LiveLogsPage] Backend-Logs nicht verfügbar:', err);
          setBackendLogs([]);
        }
      }
    } catch (err: any) {
      console.error('[LiveLogsPage] Fehler beim Laden der Logs:', err);
      setError('Fehler beim Laden der Logs: ' + (err?.message || 'Unbekannter Fehler'));
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, [logSource]);

  // Auto-Refresh alle 5 Sekunden
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadAllLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, logSource]);

  // Kombiniere und sortiere Logs
  const combinedLogs = [
    ...frontendLogs.map(log => ({ ...log, source: 'frontend' as const })),
    ...backendLogs.map(log => ({ ...log, source: 'backend' as const })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter Logs
  const filteredLogs = combinedLogs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Unique Kategorien für Filter
  const categories = Array.from(new Set(combinedLogs.map(log => log.category))).sort();

  // Level-Farben
  const getLevelColor = (level: string): "default" | "info" | "warning" | "error" | "success" => {
    switch (level.toLowerCase()) {
      case 'debug': return 'default';
      case 'info': return 'info';
      case 'warn': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Export Frontend-Logs
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const content = await exportLogs(format);
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frontend-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[LiveLogsPage] Export fehlgeschlagen:', err);
      setError('Export fehlgeschlagen');
    }
  };

  // Clear Frontend-Logs
  const handleClearFrontendLogs = async () => {
    if (window.confirm('Wirklich alle Frontend-Logs löschen?')) {
      await clearLogs();
      await loadAllLogs();
    }
  };

  // Cleanup ungültige Backend-Logs
  const handleCleanupInvalidLogs = async () => {
    if (window.confirm('Alle ungültigen Backend-Logs (mit "Invalid Date") löschen?\n\nDies betrifft nur alte Logs mit fehlerhaften Timestamps.')) {
      try {
        const response = await fetch('/api/logs/cleanup/invalid', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Cleanup fehlgeschlagen');
        }
        
        const result = await response.json();
        alert(`${result.deletedCount} ungültige Logs gelöscht!`);
        await loadAllLogs();
      } catch (err) {
        console.error('[LiveLogsPage] Cleanup fehlgeschlagen:', err);
        setError('Cleanup fehlgeschlagen');
      }
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Live System-Logs (Letzte 24 Stunden)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Zeigt nur Logs der letzten 24 Stunden von allen Benutzern. Automatische Aktualisierung alle 5 Sekunden. Frontend-Logs werden alle 60 Sekunden synchronisiert.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Log-Quelle</InputLabel>
            <Select
              value={logSource}
              label="Log-Quelle"
              onChange={(e: SelectChangeEvent) => setLogSource(e.target.value as any)}
            >
              <MenuItem value="all">Alle (Frontend + Backend)</MenuItem>
              <MenuItem value="frontend">Frontend</MenuItem>
              <MenuItem value="backend">Backend</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Level</InputLabel>
            <Select
              value={levelFilter}
              label="Level"
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="debug">Debug</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warn">Warn</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Kategorie</InputLabel>
            <Select
              value={categoryFilter}
              label="Kategorie"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Suche"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadAllLogs}
          >
            Aktualisieren
          </Button>

          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-Refresh {autoRefresh ? 'An' : 'Aus'}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('json')}
          >
            Export JSON
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>

          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClearFrontendLogs}
          >
            Frontend-Logs löschen
          </Button>

          <Button
            variant="outlined"
            size="small"
            color="warning"
            startIcon={<DeleteIcon />}
            onClick={handleCleanupInvalidLogs}
          >
            Ungültige Logs löschen
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {filteredLogs.length} Logs angezeigt (von {combinedLogs.length} gesamt)
        </Typography>
      </Paper>

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 400px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Quelle</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Kategorie</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log: any, index) => (
              <TableRow key={log.id || index} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                  {new Date(log.timestamp).toLocaleString('de-DE')}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={log.source.toUpperCase()} 
                    size="small" 
                    color={log.source === 'frontend' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={log.level.toUpperCase()} 
                    size="small" 
                    color={getLevelColor(log.level)}
                  />
                </TableCell>
                <TableCell>
                  <Chip label={log.category} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={{ maxWidth: 400 }}>
                  <Tooltip title={log.message}>
                    <Typography variant="body2" noWrap>
                      {log.message}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {log.userName || log.user?.displayName || 'N/A'}
                </TableCell>
                <TableCell>
                  {log.details && (
                    <Tooltip title={<pre>{JSON.stringify(log.details, null, 2)}</pre>}>
                      <IconButton size="small">
                        <Typography variant="caption">JSON</Typography>
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default LiveLogsPage;
