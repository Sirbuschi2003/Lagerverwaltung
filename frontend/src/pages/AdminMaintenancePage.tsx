import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Checkbox,
  MenuItem,
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
  FormControlLabel,
  LinearProgress,
  Select,
  Stepper,
  Step,
  StepLabel,
  Collapse,
  IconButton,
  InputLabel,
  FormControl,
  TextField,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
  fetchBranchResetPreview,
  resetBranchData,
  fetchBranches,
  type MaintenanceIssue,
  type UpdateStatus,
  type UpdatePhase,
  type BranchResetPreview,
  type BranchDto,
} from '../utils/api';
import useAuthStore from '../store/useAuthStore';

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
  const { user } = useAuthStore();
  const isSuperAdmin = !user?.branchId;

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
  const [waitingForCaddy, setWaitingForCaddy] = useState(false); // Caddy/Frontend noch nicht bereit
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

  // Lager zurücksetzen
  const [resetPreview, setResetPreview] = useState<BranchResetPreview | null>(null);
  const [resetPreviewLoading, setResetPreviewLoading] = useState(false);
  const [resetIncludeLocations, setResetIncludeLocations] = useState(true);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetConfirmCheck, setResetConfirmCheck] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  // Super-Admin: Branch-Auswahl
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  useEffect(() => {
    if (isSuperAdmin) {
      fetchBranches().then(setBranches).catch(() => {});
    }
  }, [isSuperAdmin]);

  const effectiveResetBranchId = isSuperAdmin ? (selectedBranchId || null) : (user?.branchId ?? null);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  const handleResetPreview = async () => {
    if (isSuperAdmin && !selectedBranchId) {
      setResetError('Bitte zuerst eine Niederlassung auswählen.');
      return;
    }
    setResetPreviewLoading(true);
    setResetPreview(null);
    setResetResult(null);
    setResetError(null);
    setResetConfirmText('');
    setResetConfirmCheck(false);
    try {
      const data = await fetchBranchResetPreview(effectiveResetBranchId);
      setResetPreview(data);
    } catch {
      setResetError('Vorschau konnte nicht geladen werden.');
    } finally {
      setResetPreviewLoading(false);
    }
  };

  const handleResetExecute = async () => {
    if (resetConfirmText !== 'LÖSCHEN' || !resetConfirmCheck) return;
    setResetLoading(true);
    setResetResult(null);
    setResetError(null);
    try {
      const result = await resetBranchData(resetIncludeLocations, effectiveResetBranchId);
      const branchLabel = selectedBranch ? ` (${selectedBranch.name})` : '';
      setResetResult(
        `Niederlassung${branchLabel} erfolgreich zurückgesetzt: ${result.deleted} Artikel` +
        (resetIncludeLocations ? `, ${result.locationsDeleted} Lagerorte` : '') +
        ` gelöscht. Alle Bestände und Buchungshistorie wurden entfernt.`
      );
      setResetPreview(null);
      setResetConfirmText('');
      setResetConfirmCheck(false);
    } catch {
      setResetError('Fehler beim Zurücksetzen. Bitte erneut versuchen.');
    } finally {
      setResetLoading(false);
    }
  };

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

  // Wartet bis Caddy + Frontend wieder erreichbar sind, dann reload.
  // Verhindert den "Firefox kann keine Verbindung herstellen"-Fehler wenn
  // docker-compose Caddy erst nach dem Backend neu startet.
  const reloadWhenReady = () => {
    setWaitingForCaddy(true);
    let attempts = 0;
    const maxAttempts = 90; // max 3 Minuten (90 × 2s)

    const check = async () => {
      attempts++;
      try {
        const resp = await fetch(window.location.origin + '/', {
          cache: 'no-cache',
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          window.location.reload();
          return;
        }
      } catch {
        // Caddy noch nicht bereit – weiter warten
      }
      if (attempts >= maxAttempts) {
        window.location.reload(); // Letzter Versuch
        return;
      }
      setTimeout(check, 2000);
    };

    // Kurze Pause damit Caddy Zeit hat neu zu starten, dann prüfen
    setTimeout(check, 3000);
  };

  const startPolling = () => {
    stopPolling();
    backendWentOfflineRef.current = false;

    // Fallback: nach 6 Minuten auf jeden Fall neu laden
    forceReloadTimerRef.current = setTimeout(() => {
      stopPolling();
      window.location.reload();
    }, 6 * 60 * 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchUpdateStatus();
        setUpdateStatus(status);

        // instanceId-Erkennung: Backend hat neu gestartet (neue Prozess-ID)
        // Aber: Caddy könnte noch nachstarten → nicht sofort reload, erst Caddy prüfen
        if (knownInstanceIdRef.current && status.instanceId && status.instanceId !== knownInstanceIdRef.current) {
          stopPolling();
          reloadWhenReady();
          return;
        }
        if (status.instanceId) {
          knownInstanceIdRef.current = status.instanceId;
        }

        if (status.updateRunning && status.updatePhase === 'pulling') {
          return;
        }

        if (backendWentOfflineRef.current) {
          // Backend war offline und ist wieder da → auch auf Caddy warten
          stopPolling();
          reloadWhenReady();
          return;
        }

        if (status.updatePhase === 'error') {
          stopPolling();
          setUpdateStarting(false);
          setWaitingForRestart(false);
          setUpdateError(status.error || 'Update fehlgeschlagen.');
          return;
        }
      } catch {
        backendWentOfflineRef.current = true;
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

  const isUpdating = updateStarting || (updateStatus?.updateRunning ?? false) || waitingForRestart || waitingForCaddy;
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
            {waitingForCaddy ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                <strong>Alle Dienste starten…</strong> Verbindung wird wiederhergestellt, Seite lädt automatisch.
              </Alert>
            ) : waitingForRestart ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Container werden neu gestartet…</strong> Bitte warten, dies kann 30–60 Sekunden dauern.
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

            <Stepper activeStep={waitingForCaddy ? 3 : waitingForRestart ? 2 : phaseToStep(currentPhase)} sx={{ mb: 2 }}>
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

      {/* ── Lager zurücksetzen ─────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WarningAmberIcon color="error" />
          <Typography variant="h6" color="error.main">Lager zurücksetzen</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Löscht <strong>alle Artikel</strong> der aktuellen Niederlassung inklusive Technikerbestände und der
          gesamten Buchungshistorie. Optional werden auch alle Lagerorte entfernt.
          Nach dem Reset kann ein sauberer Neuimport durchgeführt werden.
        </Typography>

        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Dieser Vorgang ist unwiderruflich.</strong> Technikerbestände auf Fahrzeugen und
          die komplette Buchungshistorie (wer hat wann was entnommen) werden permanent gelöscht.
        </Alert>

        {isSuperAdmin && (
          <FormControl size="small" sx={{ mb: 2, minWidth: 280 }}>
            <InputLabel>Niederlassung auswählen</InputLabel>
            <Select
              label="Niederlassung auswählen"
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setResetPreview(null);
                setResetConfirmText('');
                setResetConfirmCheck(false);
                setResetResult(null);
                setResetError(null);
              }}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}{b.externalCode ? ` (${b.externalCode})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={resetIncludeLocations}
                onChange={(e) => setResetIncludeLocations(e.target.checked)}
              />
            }
            label="Lagerorte ebenfalls löschen (Regale, Fächer)"
          />
          <Button
            variant="outlined"
            color="warning"
            onClick={handleResetPreview}
            disabled={resetPreviewLoading || (isSuperAdmin && !selectedBranchId)}
            startIcon={resetPreviewLoading ? <CircularProgress size={18} /> : <SearchIcon />}
          >
            Vorschau laden
          </Button>
        </Box>

        {resetPreview && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Folgende Daten werden unwiderruflich gelöscht:
            </Alert>
            <Table size="small" sx={{ mb: 2, maxWidth: 400 }}>
              <TableBody>
                <TableRow>
                  <TableCell>Artikel</TableCell>
                  <TableCell><strong>{resetPreview.items.toLocaleString('de-DE')}</strong></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Bestände (inkl. Technikerfahrzeuge)</TableCell>
                  <TableCell><strong>{resetPreview.stockLevels.toLocaleString('de-DE')}</strong></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Buchungshistorie (Entnahmen/Eingänge)</TableCell>
                  <TableCell><strong>{resetPreview.stockMovements.toLocaleString('de-DE')}</strong></TableCell>
                </TableRow>
                {resetIncludeLocations && (
                  <TableRow>
                    <TableCell>Lagerorte</TableCell>
                    <TableCell><strong>{resetPreview.locations.toLocaleString('de-DE')}</strong></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Typography variant="body2" sx={{ mb: 1 }}>
              Zum Bestätigen <strong>LÖSCHEN</strong> eingeben und Checkbox aktivieren:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 400 }}>
              <TextField
                size="small"
                label='Zur Bestätigung "LÖSCHEN" eingeben'
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                error={resetConfirmText.length > 0 && resetConfirmText !== 'LÖSCHEN'}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={resetConfirmCheck}
                    onChange={(e) => setResetConfirmCheck(e.target.checked)}
                    color="error"
                  />
                }
                label="Ich bestätige, dass alle Daten unwiderruflich gelöscht werden"
              />
              <Button
                variant="contained"
                color="error"
                onClick={handleResetExecute}
                disabled={resetConfirmText !== 'LÖSCHEN' || !resetConfirmCheck || resetLoading}
                startIcon={resetLoading ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Lager jetzt zurücksetzen
              </Button>
            </Box>
          </Box>
        )}

        {resetResult && <Alert severity="success">{resetResult}</Alert>}
        {resetError && <Alert severity="error">{resetError}</Alert>}
      </Paper>
    </Box>
  );
};

export default AdminMaintenancePage;
