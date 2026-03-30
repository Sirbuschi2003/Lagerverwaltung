import React, { useState, useEffect, useRef } from 'react';
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
  Stepper,
  Step,
  StepLabel,
  Collapse,
  IconButton,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArticleIcon from '@mui/icons-material/Article';
import {
  checkDatabaseMaintenance,
  fixDatabaseIssues,
  previewPurgeOldOrders,
  purgeOldOrders,
  fetchUpdateStatus,
  applyUpdate,
  fetchChangelog,
  type MaintenanceIssue,
  type UpdateStatus,
  type UpdatePhase,
} from '../utils/api';

const RETENTION_YEARS = 10;

const UPDATE_STEPS = [
  { phase: 'starting' as UpdatePhase, label: 'Gestartet' },
  { phase: 'pulling' as UpdatePhase, label: 'Images herunterladen' },
  { phase: 'restarting' as UpdatePhase, label: 'Container neu starten' },
  { phase: 'done' as UpdatePhase, label: 'Fertig' },
];

const phaseToStep = (phase: UpdatePhase): number => {
  const idx = UPDATE_STEPS.findIndex((s) => s.phase === phase);
  return idx >= 0 ? idx : 0;
};

const AdminMaintenancePage = () => {
  // DB-Wartung
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  // Update
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateStarting, setUpdateStarting] = useState(false);
  const [waitingForRestart, setWaitingForRestart] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backendWentOfflineRef = useRef(false); // Ref statt State – vermeidet Stale-Closure in setInterval
  const forceReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownInstanceIdRef = useRef<string | null>(null); // Erkennt Backend-Neustart hinter Reverse Proxy

  // Changelog
  const [changelog, setChangelog] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);

  // Bestellarchiv
  const [purgePreview, setPurgePreview] = useState<{ count: number; oldestDate: string | null; cutoffDate: string } | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  // Initialer Update-Check
  useEffect(() => {
    handleCheckUpdate();
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (forceReloadTimerRef.current) {
      clearTimeout(forceReloadTimerRef.current);
      forceReloadTimerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    backendWentOfflineRef.current = false;

    // Fallback: nach 3 Minuten auf jeden Fall neu laden
    forceReloadTimerRef.current = setTimeout(() => {
      stopPolling();
      window.location.reload();
    }, 3 * 60 * 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchUpdateStatus();
        setUpdateStatus(status);

        // instanceId-Erkennung: Wenn sich die ID ändert → Backend hat neu gestartet
        if (knownInstanceIdRef.current && status.instanceId && status.instanceId !== knownInstanceIdRef.current) {
          stopPolling();
          window.location.reload();
          return;
        }
        if (status.instanceId) {
          knownInstanceIdRef.current = status.instanceId;
        }

        if (status.updateRunning && status.updatePhase === 'pulling') {
          // Noch am Downloaden – weiter warten
          return;
        }

        if (backendWentOfflineRef.current) {
          // Backend war offline und ist jetzt wieder erreichbar → Update fertig!
          stopPolling();
          window.location.reload();
          return;
        }

        if (status.updatePhase === 'error') {
          stopPolling();
          setUpdateStarting(false);
          setWaitingForRestart(false);
          setUpdateError(status.error || 'Update fehlgeschlagen.');
          return;
        }

        // updateRunning=false und kein Fehler und kein Offline-Zeitraum
        // → Helper hat noch nicht neu gestartet oder Update war sehr schnell
        // Weiter pollen bis wir offline gehen oder Timeout
      } catch {
        // Backend nicht erreichbar = Neustart läuft
        backendWentOfflineRef.current = true; // Ref! Kein Stale-Closure-Problem
        setWaitingForRestart(true);
      }
    }, 2000);
  };

  const handleCheckUpdate = async (refresh = false) => {
    setUpdateChecking(true);
    try {
      const status = await fetchUpdateStatus(refresh);
      setUpdateStatus(status);

      // instanceId beim ersten Laden merken (Referenzpunkt für Neustart-Erkennung)
      if (status.instanceId && !knownInstanceIdRef.current) {
        knownInstanceIdRef.current = status.instanceId;
      }

      // Falls ein Update lief: nur pollen wenn es innerhalb der letzten 6 Minuten gestartet wurde
      if (status.updateRunning) {
        const startedAt = status.updateStartedAt ? new Date(status.updateStartedAt).getTime() : 0;
        const ageMs = Date.now() - startedAt;
        if (ageMs < 6 * 60 * 1000) {
          startPolling();
        } else {
          // Veralteter updateRunning-Status → ignorieren, nicht pollen
          // Backend-Timeout setzt ihn nach 5 Min zurück
        }
      }
    } catch {
      // ignore
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleLoadChangelog = async () => {
    if (changelog) {
      setChangelogOpen((o) => !o);
      return;
    }
    setChangelogLoading(true);
    try {
      const text = await fetchChangelog();
      setChangelog(text);
      setChangelogOpen(true);
    } catch {
      setChangelog('Changelog konnte nicht geladen werden.');
      setChangelogOpen(true);
    } finally {
      setChangelogLoading(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm(
      'Update jetzt einspielen?\n\nDie Anwendung wird für ca. 30–60 Sekunden nicht erreichbar sein.'
    )) return;

    setUpdateError(null);
    setUpdateStarting(true);
    try {
      await applyUpdate();
      // Sofort pollen starten
      startPolling();
    } catch (err: any) {
      setUpdateError('Fehler beim Starten: ' + (err.response?.data?.message || err.message));
      setUpdateStarting(false);
    }
  };

  // DB-Wartung
  const checkForIssues = async () => {
    setLoading(true);
    setFixResult(null);
    try {
      const response = await checkDatabaseMaintenance();
      setIssues(response.issues || []);
      setLastCheck(new Date());
    } catch (error: any) {
      alert('Fehler beim Überprüfen der Datenbank: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fixIssues = async () => {
    if (!window.confirm('Möchten Sie alle gefundenen Probleme automatisch beheben?')) return;
    setFixing(true);
    setFixResult(null);
    try {
      const result = await fixDatabaseIssues();
      setFixResult(`Erfolgreich ${result.fixed} Probleme behoben. ${result.message}`);
      setIssues([]);
      setTimeout(() => checkForIssues(), 1000);
    } catch (error: any) {
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

  const isUpdating = updateStarting || (updateStatus?.updateRunning ?? false) || waitingForRestart;
  const currentPhase = updateStatus?.updatePhase ?? 'idle';
  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <Box sx={{ p: 3 }}>

      {/* ===== Update-Sektion ===== */}
      <Paper sx={{
        p: 3, mb: 3,
        border: updateStatus?.updateAvailable && !isUpdating ? '2px solid' : '1px solid',
        borderColor: updateStatus?.updateAvailable && !isUpdating ? 'info.main' : 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SystemUpdateAltIcon sx={{ fontSize: 40, color: updateStatus?.updateAvailable ? 'info.main' : 'text.secondary' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Software-Update</Typography>
            <Typography variant="body2" color="text.secondary">
              Automatisches Update aus GitHub – alle Container werden neu gestartet
            </Typography>
          </Box>
          {!isUpdating && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleCheckUpdate(true)}
              disabled={updateChecking}
              startIcon={updateChecking ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              Prüfen
            </Button>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Fortschrittsanzeige während Update */}
        {isUpdating && (
          <Box sx={{ mb: 2 }}>
            {waitingForRestart ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Backend startet neu…</strong> Verbindung wird wiederhergestellt, bitte warten.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>
                  {currentPhase === 'starting' && 'Update wird gestartet…'}
                  {currentPhase === 'pulling' && 'Neue Images werden heruntergeladen…'}
                  {currentPhase === 'restarting' && 'Container werden neu gestartet…'}
                </strong>
              </Alert>
            )}

            <Stepper activeStep={waitingForRestart ? 2 : phaseToStep(currentPhase)} sx={{ mb: 2 }}>
              {UPDATE_STEPS.filter(s => s.phase !== 'done').map((step) => (
                <Step key={step.phase}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />

            {/* Live-Log */}
            {updateStatus?.updateLog && updateStatus.updateLog.length > 0 && (
              <Box sx={{
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                maxHeight: 160,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}>
                {updateStatus.updateLog.map((line, i) => (
                  <Typography key={i} variant="caption" display="block" sx={{ fontFamily: 'monospace', lineHeight: 1.6 }}>
                    {line}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Fehler-Anzeige */}
        {(updateError || (updateStatus?.updatePhase === 'error' && !isUpdating)) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {updateError || updateStatus?.error || 'Update fehlgeschlagen'}
          </Alert>
        )}

        {/* Normal-Ansicht (kein Update aktiv) */}
        {!isUpdating && (
          <>
            {updateStatus ? (
              <>
                <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Installierte Version</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {updateStatus.currentVersion === 'dev' ? 'dev' : `v${updateStatus.currentVersion}`}
                    </Typography>
                  </Box>
                  {updateStatus.latestVersion && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Neueste Version (GitHub)</Typography>
                      <Typography variant="body1" sx={{
                        fontWeight: 700,
                        color: updateStatus.updateAvailable ? 'info.main' : 'success.main',
                      }}>
                        v{updateStatus.latestVersion}
                      </Typography>
                    </Box>
                  )}
                  {updateStatus.lastChecked && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Zuletzt geprüft</Typography>
                      <Typography variant="body2">
                        {new Date(updateStatus.lastChecked).toLocaleString('de-DE')}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {updateStatus.error ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>{updateStatus.error}</Alert>
                ) : updateStatus.updateAvailable ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Neue Version v{updateStatus.latestVersion} verfügbar!</strong>
                  </Alert>
                ) : (
                  <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                    Die Anwendung ist aktuell (v{updateStatus.currentVersion}).
                  </Alert>
                )}

                {/* Changelog-Anzeige */}
                {updateStatus.updateAvailable && (
                  <Box sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={changelogLoading ? <CircularProgress size={14} /> : <ArticleIcon />}
                      endIcon={changelogOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      onClick={handleLoadChangelog}
                      disabled={changelogLoading}
                    >
                      Was hat sich geändert?
                    </Button>
                    <Collapse in={changelogOpen}>
                      <Box sx={{
                        mt: 1,
                        p: 2,
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        maxHeight: 300,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        lineHeight: 1.6,
                      }}>
                        {changelog}
                      </Box>
                    </Collapse>
                  </Box>
                )}

                {updateStatus.updateAvailable && !updateStatus.error && (
                  <Button
                    variant="contained"
                    color="info"
                    onClick={handleApplyUpdate}
                    startIcon={<SystemUpdateAltIcon />}
                    size="large"
                  >
                    Jetzt updaten auf v{updateStatus.latestVersion}
                  </Button>
                )}
              </>
            ) : (
              <Alert severity="info">Update-Status wird geladen…</Alert>
            )}
          </>
        )}
      </Paper>

      {/* ===== Datenbank-Wartung ===== */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <BuildIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Datenbank-Wartung</Typography>
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
          <Alert severity="success" sx={{ mb: 3 }}>{fixResult}</Alert>
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>• RestockRequests mit quantityNeeded = 0 (sollten FULFILLED sein)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>• Duplikate RestockRequests für denselben StockLevel</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>• Verwaiste RestockRequests ohne StockLevel</Typography>
          <Typography variant="body2" color="text.secondary">• Inkonsistente Status-Kombinationen</Typography>
        </Box>
      </Paper>

      {/* ===== Bestellarchiv bereinigen ===== */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <DeleteSweepIcon sx={{ fontSize: 40, color: 'warning.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Bestellarchiv bereinigen</Typography>
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
          <Alert severity="success" sx={{ mt: 2 }}>{purgeResult}</Alert>
        )}
      </Paper>
    </Box>
  );
};

export default AdminMaintenancePage;
