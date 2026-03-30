import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import { checkDatabaseMaintenance, fixDatabaseIssues, previewPurgeOldOrders, purgeOldOrders, fetchUpdateStatus, applyUpdate, type MaintenanceIssue, type UpdateStatus } from '../utils/api';

const RETENTION_YEARS = 10;

const AdminMaintenancePage = () => {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  // Update-Status
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateRestarting, setUpdateRestarting] = useState(false);

  // Bestellarchiv-Bereinigung
  const [purgePreview, setPurgePreview] = useState<{ count: number; oldestDate: string | null; cutoffDate: string } | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  useEffect(() => {
    handleCheckUpdate();
  }, []);

  const handleCheckUpdate = async (refresh = false) => {
    setUpdateChecking(true);
    try {
      const status = await fetchUpdateStatus(refresh);
      setUpdateStatus(status);
    } catch {
      // ignore
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm('Update jetzt einspielen?\n\nDie Anwendung wird für ca. 30–60 Sekunden nicht erreichbar sein.')) return;
    setUpdateLoading(true);
    setUpdateMessage(null);
    try {
      const result = await applyUpdate();
      setUpdateMessage(result.message);
      setUpdateRestarting(true);
      // Warte bis Backend wieder erreichbar ist, dann Seite neu laden
      const pollRestart = async () => {
        await new Promise((r) => setTimeout(r, 5000));
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const s = await fetchUpdateStatus();
            if (s) {
              clearInterval(poll);
              window.location.reload();
            }
          } catch {
            if (attempts > 24) {
              clearInterval(poll);
              setUpdateRestarting(false);
              setUpdateMessage('Neustart dauert länger als erwartet. Bitte Seite manuell neu laden.');
            }
          }
        }, 5000);
      };
      pollRestart();
    } catch (err: any) {
      setUpdateMessage('Fehler: ' + (err.response?.data?.message || err.message));
      setUpdateLoading(false);
    }
  };

  const checkForIssues = async () => {
    setLoading(true);
    setFixResult(null);
    try {
      const response = await checkDatabaseMaintenance();
      setIssues(response.issues || []);
      setLastCheck(new Date());
    } catch (error: any) {
      console.error('Fehler beim Überprüfen:', error);
      alert('Fehler beim Überprüfen der Datenbank: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fixIssues = async () => {
    if (!window.confirm('Möchten Sie alle gefundenen Probleme automatisch beheben?')) {
      return;
    }

    setFixing(true);
    setFixResult(null);
    try {
      const result = await fixDatabaseIssues();
      setFixResult(`Erfolgreich ${result.fixed} Probleme behoben. ${result.message}`);
      setIssues([]);
      
      // Nach dem Fix erneut prüfen
      setTimeout(() => {
        checkForIssues();
      }, 1000);
    } catch (error: any) {
      console.error('Fehler beim Beheben:', error);
      alert('Fehler beim Beheben der Probleme: ' + (error.response?.data?.message || error.message));
    } finally {
      setFixing(false);
    }
  };

  const handlePurgePreview = async () => {
    setPurgeLoading(true);
    setPurgeResult(null);
    try {
      const result = await previewPurgeOldOrders(RETENTION_YEARS);
      setPurgePreview(result);
    } catch (error: any) {
      alert('Fehler beim Prüfen: ' + (error.response?.data?.message || error.message));
    } finally {
      setPurgeLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!purgePreview || purgePreview.count === 0) return;
    if (!window.confirm(
      `Möchten Sie wirklich ${purgePreview.count} Bestellung(en) älter als ${RETENTION_YEARS} Jahre unwiderruflich löschen?\n\nDies löscht auch die zugehörigen PDF-Dateien.`
    )) return;

    setPurgeLoading(true);
    try {
      const result = await purgeOldOrders(RETENTION_YEARS);
      setPurgeResult(`${result.deleted} Bestellung(en) erfolgreich gelöscht.`);
      setPurgePreview(null);
    } catch (error: any) {
      alert('Fehler beim Löschen: ' + (error.response?.data?.message || error.message));
    } finally {
      setPurgeLoading(false);
    }
  };

  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* ===== Update-Sektion ===== */}
      <Paper sx={{ p: 3, mb: 3, border: updateStatus?.updateAvailable ? '2px solid' : undefined, borderColor: 'info.main' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SystemUpdateAltIcon sx={{ fontSize: 40, color: updateStatus?.updateAvailable ? 'info.main' : 'text.secondary' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Software-Update
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Automatisches Update aus GitHub – alle Container werden neu gestartet
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleCheckUpdate(true)}
            disabled={updateChecking}
            startIcon={updateChecking ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            Prüfen
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        {updateRestarting ? (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Update wird eingespielt…</strong> Die Anwendung startet neu. Bitte warten.
            </Alert>
            <LinearProgress />
          </Box>
        ) : updateStatus ? (
          <Box>
            <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Installierte Version</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {updateStatus.currentVersion}
                </Typography>
              </Box>
              {updateStatus.latestVersion && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Neueste Version (GitHub)</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: updateStatus.updateAvailable ? 'info.main' : 'success.main' }}>
                    {updateStatus.latestVersion}
                  </Typography>
                </Box>
              )}
              {updateStatus.lastChecked && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Zuletzt geprüft</Typography>
                  <Typography variant="body2">{new Date(updateStatus.lastChecked).toLocaleString('de-DE')}</Typography>
                </Box>
              )}
            </Box>

            {updateStatus.error ? (
              <Alert severity="warning" sx={{ mb: 2 }}>{updateStatus.error}</Alert>
            ) : updateStatus.updateAvailable ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Neue Version verfügbar!</strong> Version <code>{updateStatus.latestVersion}</code> ist auf GitHub bereit.
              </Alert>
            ) : (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                Die Anwendung ist aktuell.
              </Alert>
            )}

            {updateStatus.updateAvailable && !updateStatus.error && (
              <Button
                variant="contained"
                color="info"
                onClick={handleApplyUpdate}
                disabled={updateLoading}
                startIcon={updateLoading ? <CircularProgress size={20} /> : <SystemUpdateAltIcon />}
                size="large"
              >
                {updateLoading ? 'Update wird gestartet…' : 'Jetzt updaten'}
              </Button>
            )}

            {updateMessage && !updateRestarting && (
              <Alert severity={updateMessage.startsWith('Fehler') ? 'error' : 'info'} sx={{ mt: 2 }}>
                {updateMessage}
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info">Update-Status wird geladen…</Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <BuildIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Datenbank-Wartung
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Überprüfung und Bereinigung von Dateninkonsistenzen
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            onClick={checkForIssues}
            disabled={loading || fixing}
            startIcon={loading ? <CircularProgress size={20} /> : <ErrorIcon />}
          >
            {loading ? 'Überprüfe...' : 'Probleme prüfen'}
          </Button>

          {totalIssues > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={fixIssues}
              disabled={loading || fixing}
              startIcon={fixing ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              {fixing ? 'Behebe...' : `${totalIssues} Problem(e) beheben`}
            </Button>
          )}
        </Box>

        {lastCheck && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Letzte Überprüfung: {lastCheck.toLocaleString('de-DE')}
          </Typography>
        )}

        {fixResult && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {fixResult}
          </Alert>
        )}

        {issues.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Schweregrad</TableCell>
                  <TableCell>Problem</TableCell>
                  <TableCell align="right">Anzahl</TableCell>
                  <TableCell>Beschreibung</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issues.map((issue, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Chip
                        label={issue.severity === 'error' ? 'Fehler' : 'Warnung'}
                        color={issue.severity === 'error' ? 'error' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{issue.type}</TableCell>
                    <TableCell align="right">
                      <Chip label={issue.count} color="primary" size="small" />
                    </TableCell>
                    <TableCell>{issue.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : lastCheck ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Keine Probleme gefunden! Die Datenbank ist konsistent.
          </Alert>
        ) : (
          <Alert severity="info">
            Klicken Sie auf "Probleme prüfen", um die Datenbank zu überprüfen.
          </Alert>
        )}

        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Automatische Prüfungen:
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • RestockRequests mit quantityNeeded = 0 (sollten FULFILLED sein)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Duplikate RestockRequests für denselben StockLevel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Verwaiste RestockRequests ohne StockLevel
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Inkonsistente Status-Kombinationen
          </Typography>
        </Box>
      </Paper>

      {/* Bestellarchiv bereinigen */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <DeleteSweepIcon sx={{ fontSize: 40, color: 'warning.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Bestellarchiv bereinigen
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Abgeschlossene und stornierte Bestellungen nach Ablauf der gesetzlichen Aufbewahrungsfrist löschen
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Alert severity="info" sx={{ mb: 2 }}>
          Es werden Bestellungen mit Status <strong>Eingegangen</strong>, <strong>Archiviert</strong> oder <strong>Storniert</strong> gelöscht,
          die älter als <strong>{RETENTION_YEARS} Jahre</strong> sind. Die zugehörigen PDF-Dateien werden ebenfalls entfernt.
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            color="warning"
            onClick={handlePurgePreview}
            disabled={purgeLoading}
            startIcon={purgeLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          >
            Vorschau anzeigen
          </Button>

          {purgePreview && purgePreview.count > 0 && (
            <Button
              variant="contained"
              color="error"
              onClick={handlePurge}
              disabled={purgeLoading}
              startIcon={purgeLoading ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
            >
              {purgePreview.count} Bestellung(en) endgültig löschen
            </Button>
          )}
        </Box>

        {purgePreview && (
          purgePreview.count === 0 ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Keine Bestellungen gefunden, die älter als {RETENTION_YEARS} Jahre sind.
            </Alert>
          ) : (
            <Alert severity="warning">
              <strong>{purgePreview.count} Bestellung(en)</strong> würden gelöscht
              (Stichtag: {new Date(purgePreview.cutoffDate).toLocaleDateString('de-DE')}
              {purgePreview.oldestDate && `, älteste: ${new Date(purgePreview.oldestDate).toLocaleDateString('de-DE')}`}).
            </Alert>
          )
        )}

        {purgeResult && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {purgeResult}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default AdminMaintenancePage;
