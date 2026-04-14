import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Backdrop,
} from '@mui/material';
import {
  CloudDownload as BackupIcon,
  CloudUpload as RestoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import useAuthStore from '../store/useAuthStore';
import { getAutoBackupConfig, setAutoBackupConfig, getLastAutoBackup, listAutoBackups, downloadAutoBackup, deleteAutoBackup, type AutoBackupConfig, type AutoBackupFile } from '../utils/api';

const BackupPage = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state: any) => state.token);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>({ enabled: false, frequency: 'daily', time: '02:00', lastBackup: null });
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info'}>({ open: false, message: '', severity: 'info' });
  
  // Auto-Backup Dateien
  const [backupFiles, setBackupFiles] = useState<AutoBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; filename: string | null }>({ open: false, filename: null });
  const [deletingFile, setDeletingFile] = useState(false);
  const busy = backupLoading || restoreLoading;

  const validateBackupPayload = (payload: any) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Backup-Datei ist leer oder ungültig.');
    }
    if (payload.version && payload.version !== '1.0') {
      throw new Error(`Backup-Version wird nicht unterstützt (gefunden: ${payload.version}).`);
    }
    if (!payload.data || typeof payload.data !== 'object') {
      throw new Error('Backup enthält keine gültigen Daten.');
    }
  };

  // Auto-Backup Konfiguration laden
  useEffect(() => {
    (async () => {
      setConfigLoading(true);
      try {
        const cfg = await getAutoBackupConfig();
        const last = await getLastAutoBackup();
        
        // UTC-Zeit vom Server in lokale Zeit konvertieren
        let localTime = cfg.time;
        if (cfg.time) {
          const [hours, minutes] = cfg.time.split(':').map(Number);
          const utcDate = new Date();
          utcDate.setUTCHours(hours, minutes, 0, 0);
          const localHours = utcDate.getHours();
          const localMinutes = utcDate.getMinutes();
          localTime = `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
        }
        
        setAutoConfig({ ...cfg, time: localTime, lastBackup: last.lastBackup });
      } catch (e) {
        console.warn('Konnte Auto-Backup-Konfiguration nicht laden:', e);
      } finally {
        setConfigLoading(false);
      }
    })();
  }, []);

  // Auto-Backup Dateien laden
  const loadBackupFiles = async () => {
    setLoadingFiles(true);
    try {
      const { backups } = await listAutoBackups();
      setBackupFiles(backups);
    } catch (e) {
      console.error('Fehler beim Laden der Backup-Dateien:', e);
      setSnackbar({ open: true, message: 'Fehler beim Laden der Backup-Dateien', severity: 'error' });
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadBackupFiles();
  }, []);

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      const response = await fetch('/api/setup/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backup-Fehler:', errorText);
        throw new Error(`Backup fehlgeschlagen: ${response.status}`);
      }
      
      const backup = await response.json();
      const filename = `lagerverwaltung-backup-${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setBackupMessage({ type: 'success', text: 'Backup erfolgreich heruntergeladen (Serverkopie erstellt).' });
      await loadBackupFiles(); // Serverliste aktualisieren (Kopie wird jetzt abgelegt)
    } catch (error) {
      console.error('Backup-Fehler:', error);
      setBackupMessage({ type: 'error', text: 'Backup fehlgeschlagen. Bitte versuche es erneut.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'WARNUNG: Diese Aktion löscht ALLE aktuellen Daten und ersetzt sie durch die Backup-Daten!\n\n' +
      'Alle Artikel, Fahrzeuge, Bestände, Benutzer und Bewegungen werden überschrieben.\n\n' +
      'Bist du dir absolut sicher?'
    );

    if (!confirmRestore) {
      event.target.value = '';
      return;
    }

    setRestoreLoading(true);
    setBackupMessage(null);
    
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      validateBackupPayload(backup);
      
      const response = await fetch('/api/setup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(backup),
      });
      
      if (!response.ok) throw new Error('Restore fehlgeschlagen');
      
      setBackupMessage({ 
        type: 'success', 
        text: 'Datenbank erfolgreich wiederhergestellt! Bitte neu anmelden.' 
      });
      
      // Nach 2 Sekunden ausloggen und zur Login-Seite
      setTimeout(() => {
        localStorage.removeItem('token');
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Restore-Fehler:', error);
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setBackupMessage({ 
        type: 'error', 
        text: `Wiederherstellung fehlgeschlagen. Prüfe die Backup-Datei. Details: ${msg}` 
      });
    } finally {
      setRestoreLoading(false);
      event.target.value = '';
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Backdrop open={busy} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography variant="subtitle1">
          {restoreLoading ? 'Backup wird wiederhergestellt...' : 'Backup wird erstellt...'}
        </Typography>
      </Backdrop>
      <Typography variant="h4" gutterBottom>
        Datensicherung & Wiederherstellung
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Erstelle ein vollständiges Backup aller Daten oder stelle ein früheres Backup wieder her. Backups werden serverseitig im Verzeichnis /app/backups (Docker-Volume) gespeichert und bleiben auch nach einem Container-Neustart erhalten.
      </Typography>

      {backupMessage && (
        <Alert 
          severity={backupMessage.type} 
          sx={{ mb: 3 }}
          onClose={() => setBackupMessage(null)}
        >
          {backupMessage.text}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BackupIcon />
            Backup erstellen
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Lädt eine JSON-Datei mit allen Daten herunter (Artikel, Fahrzeuge, Benutzer, Bestände, Bewegungen, Inventuren).
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDownloadBackup}
            disabled={backupLoading || restoreLoading}
            startIcon={backupLoading ? <CircularProgress size={20} /> : <BackupIcon />}
          >
            {backupLoading ? 'Erstelle Backup...' : 'Backup herunterladen'}
          </Button>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreIcon />
            Backup wiederherstellen
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>ACHTUNG:</strong> Diese Aktion löscht ALLE aktuellen Daten unwiderruflich!
            <br />
            Alle Artikel, Fahrzeuge, Bestände, Benutzer und Bewegungen werden durch die Backup-Daten ersetzt.
          </Alert>
          <Typography variant="body2" color="text.secondary" paragraph>
            Wähle eine zuvor heruntergeladene Backup-Datei aus, um die Datenbank wiederherzustellen.
          </Typography>
          <Button
            variant="contained"
            color="error"
            component="label"
            disabled={backupLoading || restoreLoading}
            startIcon={restoreLoading ? <CircularProgress size={20} /> : <RestoreIcon />}
          >
            {restoreLoading ? 'Stelle wieder her...' : 'Backup hochladen & wiederherstellen'}
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleRestoreBackup}
            />
          </Button>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box>
          <Typography variant="h6" gutterBottom>
            Automatisches Backup
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Plane automatische Backups zu festen Zeiten. Backups werden als Datei im Server-Verzeichnis gespeichert.
          </Typography>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <Switch
                checked={autoConfig.enabled}
                onChange={(e) => setAutoConfig(c => ({ ...c, enabled: e.target.checked }))}
                disabled={configLoading || savingConfig}
              />
              <Typography>Aktiviert</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 150 }} disabled={!autoConfig.enabled || savingConfig}>
              <InputLabel>Frequenz</InputLabel>
              <Select
                label="Frequenz"
                value={autoConfig.frequency}
                onChange={(e) => setAutoConfig(c => ({ ...c, frequency: e.target.value as any }))}
              >
                <MenuItem value="daily">Täglich</MenuItem>
                <MenuItem value="weekly">Wöchentlich</MenuItem>
                <MenuItem value="monthly">Monatlich</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Uhrzeit"
              type="time"
              value={autoConfig.time}
              onChange={(e) => setAutoConfig(c => ({ ...c, time: e.target.value }))}
              disabled={!autoConfig.enabled || savingConfig}
              inputProps={{ step: 300 }}
            />
            <TextField
              size="small"
              label="Aufbewahrung (Tage)"
              type="number"
              value={autoConfig.retentionDays || 30}
              onChange={(e) => setAutoConfig(c => ({ ...c, retentionDays: Math.max(1, Math.min(365, Number(e.target.value) || 30)) }))}
              disabled={!autoConfig.enabled || savingConfig}
              inputProps={{ min: 1, max: 365 }}
              sx={{ width: 160 }}
            />
            <Button
              variant="contained"
              color="primary"
              disabled={savingConfig}
              onClick={async () => {
                setSavingConfig(true);
                try {
                  // Lokale Zeit in UTC konvertieren für Backend
                  const [hours, minutes] = autoConfig.time.split(':').map(Number);
                  const localDate = new Date();
                  localDate.setHours(hours, minutes, 0, 0);
                  const utcHours = localDate.getUTCHours();
                  const utcMinutes = localDate.getUTCMinutes();
                  const utcTime = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
                  
                  await setAutoBackupConfig({ 
                    enabled: autoConfig.enabled, 
                    frequency: autoConfig.frequency, 
                    time: utcTime,
                    retentionDays: autoConfig.retentionDays 
                  });
                  setSnackbar({ open: true, message: 'Konfiguration gespeichert (Zeit in UTC konvertiert)', severity: 'success' });
                } catch (e) {
                  setSnackbar({ open: true, message: 'Fehler beim Speichern', severity: 'error' });
                } finally {
                  setSavingConfig(false);
                }
              }}
            >
              Speichern
            </Button>
            <Button
              variant="outlined"
              onClick={async () => {
                try {
                  const cfg = await getAutoBackupConfig();
                  const last = await getLastAutoBackup();
                  
                  // UTC-Zeit vom Server in lokale Zeit konvertieren
                  let localTime = cfg.time;
                  if (cfg.time) {
                    const [hours, minutes] = cfg.time.split(':').map(Number);
                    const utcDate = new Date();
                    utcDate.setUTCHours(hours, minutes, 0, 0);
                    const localHours = utcDate.getHours();
                    const localMinutes = utcDate.getMinutes();
                    localTime = `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
                  }
                  
                  setAutoConfig({ ...cfg, time: localTime, lastBackup: last.lastBackup });
                  setSnackbar({ open: true, message: 'Konfiguration aktualisiert', severity: 'info' });
                } catch (e) {
                  setSnackbar({ open: true, message: 'Fehler beim Laden', severity: 'error' });
                }
              }}
            >
              Aktualisieren
            </Button>
          </Box>
          <Alert severity={autoConfig.enabled ? 'success' : 'info'} sx={{ mb: 2 }}>
            {autoConfig.enabled 
              ? `Automatische Backups aktiviert: ${autoConfig.frequency} um ${autoConfig.time} (Aufbewahrung: ${autoConfig.retentionDays || 30} Tage)` 
              : 'Automatische Backups sind deaktiviert.'}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Letztes automatisches Backup: {autoConfig.lastBackup ? new Date(autoConfig.lastBackup).toLocaleString('de-DE') : 'Noch keines'}
          </Typography>
        </Box>
      </Paper>

      {/* Gespeicherte Backups */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Gespeicherte Backups (Server)</Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadBackupFiles}
            disabled={loadingFiles}
          >
            Aktualisieren
          </Button>
        </Box>
        {loadingFiles ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : backupFiles.length === 0 ? (
          <Alert severity="info">Keine gespeicherten Backups vorhanden.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Typ</TableCell>
                  <TableCell>Dateiname</TableCell>
                  <TableCell align="right">Größe</TableCell>
                  <TableCell align="right">Erstellt</TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backupFiles.map((file) => (
                  <TableRow key={file.filename} hover>
                    <TableCell>{file.type === 'manual' ? 'Manuell' : 'Automatisch'}</TableCell>
                    <TableCell>{file.filename}</TableCell>
                    <TableCell align="right">{(file.size / 1024).toFixed(2)} KB</TableCell>
                    <TableCell align="right">{new Date(file.created).toLocaleString('de-DE')}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={async () => {
                          try {
                            const blob = await downloadAutoBackup(file.filename);
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            setSnackbar({ open: true, message: 'Backup heruntergeladen', severity: 'success' });
                          } catch (e) {
                            console.error('Download-Fehler:', e);
                            setSnackbar({ open: true, message: 'Fehler beim Herunterladen', severity: 'error' });
                          }
                        }}
                        title="Herunterladen"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, filename: file.filename })}
                        title="Löschen"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Lösch-Bestätigungsdialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deletingFile && setDeleteDialog({ open: false, filename: null })}
      >
        <DialogTitle>Backup löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchten Sie die Backup-Datei "{deleteDialog.filename}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, filename: null })} disabled={deletingFile}>
            Abbrechen
          </Button>
          <Button
            onClick={async () => {
              if (!deleteDialog.filename) return;
              setDeletingFile(true);
              try {
                await deleteAutoBackup(deleteDialog.filename);
                setSnackbar({ open: true, message: 'Backup gelöscht', severity: 'success' });
                setDeleteDialog({ open: false, filename: null });
                await loadBackupFiles(); // Liste neu laden
              } catch (e) {
                console.error('Lösch-Fehler:', e);
                setSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' });
              } finally {
                setDeletingFile(false);
              }
            }}
            color="error"
            disabled={deletingFile}
            autoFocus
          >
            {deletingFile ? <CircularProgress size={20} /> : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Container>
  );
};

export default BackupPage;

