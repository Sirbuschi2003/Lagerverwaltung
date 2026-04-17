import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Alert, CircularProgress,
  Switch, FormControl, InputLabel, Select, MenuItem, TextField, Divider,
  Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Backdrop, Chip, Checkbox, FormControlLabel, FormGroup, Tooltip,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CloudDownload as BackupIcon,
  CloudUpload as RestoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  FolderOpen as LoadIcon,
  DirectionsCar as VehicleIcon,
  Warehouse as WarehouseIcon,
  Business as BranchIcon,
} from '@mui/icons-material';
import useAuthStore from '../store/useAuthStore';
import {
  getAutoBackupConfig, setAutoBackupConfig, getLastAutoBackup,
  listAutoBackups, downloadAutoBackup, deleteAutoBackup,
  restoreSelective, loadBackupFromServer,
  type AutoBackupConfig, type AutoBackupFile, type RestoreFilters,
} from '../utils/api';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface BackupBranch { id: string; name: string; code?: string }
interface BackupVehicle { id: string; licensePlate?: string; name?: string; identifier?: string }
interface BackupLocation { id: string; type: string; code: string; name?: string; parentId?: string | null; vehicleId?: string | null; branchId?: string | null }

interface BackupAnalysis {
  filename: string;
  version: string;
  timestamp: string;
  branches: BackupBranch[];
  vehicles: BackupVehicle[];
  topLevelLocations: BackupLocation[];   // Typ WAREHOUSE ohne parentId + ohne vehicleId
  isMultiBranch: boolean;
  hasBranchlessLocations: boolean;
  counts: Record<string, number>;
}

interface SectionConfig {
  key: string;
  label: string;
  description: string;
  countKey?: string;
  showVehicleFilter?: boolean;
  showLocationFilter?: boolean;
  dependsOn?: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'items',             label: 'Artikel',              description: 'Artikel-Stammdaten & Codes',                     countKey: 'items',             showLocationFilter: true },
  { key: 'stockLevels',       label: 'Bestände',             description: 'Lager- & Fahrzeugbestände',                      countKey: 'stockLevels',       showVehicleFilter: true, showLocationFilter: true, dependsOn: 'Artikel + Fahrzeuge müssen vorhanden sein' },
  { key: 'stockMovements',    label: 'Buchungshistorie',      description: 'Alle Ein- & Ausbuchungen',                       countKey: 'stockMovements',    showVehicleFilter: true, dependsOn: 'Artikel + Fahrzeuge müssen vorhanden sein' },
  { key: 'vehicles',          label: 'Fahrzeuge',            description: 'Fahrzeugliste' ,                                 countKey: 'vehicles' },
  { key: 'locations',         label: 'Lagerorte',            description: 'Regale, Fächer (keine Fahrzeuge)',               countKey: 'locations' },
  { key: 'suppliers',         label: 'Lieferanten',          description: 'Lieferanten-Stammdaten',                         countKey: 'suppliers' },
  { key: 'purchaseOrders',    label: 'Bestellungen',         description: 'Bestellungen & Positionen',                      countKey: 'purchaseOrders',    dependsOn: 'Artikel + Lieferanten müssen vorhanden sein' },
  { key: 'inventorySessions', label: 'Inventursitzungen',    description: 'Inventur-Sessions & Zeilen',                     countKey: 'inventorySessions', dependsOn: 'Artikel + Fahrzeuge müssen vorhanden sein' },
  { key: 'users',             label: 'Benutzer & Rechte',    description: 'Benutzer, Rollen & Berechtigungen',              countKey: 'users' },
  { key: 'systemConfig',      label: 'Systemeinstellungen',  description: 'System- & Niederlassungs-Konfiguration' },
];

// ─── Analyse-Funktion ─────────────────────────────────────────────────────────

function analyzeBackup(payload: any, filename: string): BackupAnalysis {
  const d = payload.data ?? {};
  const branches: BackupBranch[] = d.branches ?? [];
  const locations: BackupLocation[] = d.locations ?? [];
  const topLevelLocations = locations.filter(
    l => l.type === 'WAREHOUSE' && !l.parentId && !l.vehicleId
  );
  const hasBranchlessLocations = locations.some(l => !l.branchId);

  const countOf = (key: string, altKey?: string): number => {
    if (key === 'systemConfig') return (d.systemConfigs?.length ?? 0) + (d.branchConfigs?.length ?? 0);
    return d[key]?.length ?? (altKey ? d[altKey]?.length ?? 0 : 0);
  };

  const counts: Record<string, number> = {};
  for (const s of SECTIONS) counts[s.key] = countOf(s.countKey ?? s.key);

  return {
    filename,
    version: payload.version ?? '?',
    timestamp: payload.timestamp ?? '',
    branches,
    vehicles: d.vehicles ?? [],
    topLevelLocations,
    isMultiBranch: branches.length > 1,
    hasBranchlessLocations,
    counts,
  };
}

// Alle Location-IDs eines Warehouses inkl. Kinder (für Filter)
function locationSubtree(rootId: string, allLocations: BackupLocation[]): string[] {
  const result = [rootId];
  const children = allLocations.filter(l => l.parentId === rootId);
  for (const child of children) result.push(...locationSubtree(child.id, allLocations));
  return result;
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

const BackupPage = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state: any) => state.token);

  // Backup erstellen
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-Backup
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>({ enabled: false, frequency: 'daily', time: '02:00', lastBackup: null });
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Server-Backups Liste
  const [backupFiles, setBackupFiles] = useState<AutoBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; filename: string | null }>({ open: false, filename: null });
  const [deletingFile, setDeletingFile] = useState(false);

  // Restore Wizard
  const [loadedBackup, setLoadedBackup] = useState<any>(null);
  const [analysis, setAnalysis] = useState<BackupAnalysis | null>(null);
  const [loadingServerBackup, setLoadingServerBackup] = useState<string | null>(null);

  // Restore-Konfiguration
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  const [vehicleFilterAll, setVehicleFilterAll] = useState(true);
  const [locationFilterAll, setLocationFilterAll] = useState(true);

  // Vollständige Wiederherstellung
  const [fullRestoreLoading, setFullRestoreLoading] = useState(false);
  const [fullRestoreConfirm, setFullRestoreConfirm] = useState(false);

  // Selektive Wiederherstellung
  const [selectiveLoading, setSelectiveLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });

  // ── Laden ──────────────────────────────────────────────────────────────────

  const loadBackupFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const { backups } = await listAutoBackups();
      setBackupFiles(backups);
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Laden der Backup-Dateien', severity: 'error' });
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setConfigLoading(true);
      try {
        const [cfg, last] = await Promise.all([getAutoBackupConfig(), getLastAutoBackup()]);
        let localTime = cfg.time;
        if (cfg.time) {
          const [h, m] = cfg.time.split(':').map(Number);
          const d = new Date(); d.setUTCHours(h, m, 0, 0);
          localTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        setAutoConfig({ ...cfg, time: localTime, lastBackup: last.lastBackup });
      } catch { /* ignore */ } finally { setConfigLoading(false); }
    })();
    loadBackupFiles();
  }, [loadBackupFiles]);

  // ── Backup laden (Datei oder Server) ──────────────────────────────────────

  const processLoadedBackup = (payload: any, filename: string) => {
    const supportedVersions = ['1.0', '2.0'];
    if (payload.version && !supportedVersions.includes(payload.version)) {
      setBackupMessage({ type: 'error', text: `Backup-Version ${payload.version} wird nicht unterstützt.` });
      return;
    }
    if (!payload?.data || typeof payload.data !== 'object') {
      setBackupMessage({ type: 'error', text: 'Ungültige Backup-Datei.' });
      return;
    }
    const ana = analyzeBackup(payload, filename);
    setLoadedBackup(payload);
    setAnalysis(ana);
    setSelectedSections([]);
    setTargetBranchId(ana.branches[0]?.id ?? '');
    setVehicleFilterAll(true);
    setLocationFilterAll(true);
    setSelectedVehicleIds([]);
    setSelectedWarehouseIds([]);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      const text = await file.text();
      processLoadedBackup(JSON.parse(text), file.name);
    } catch {
      setBackupMessage({ type: 'error', text: 'Datei konnte nicht gelesen werden.' });
    }
  };

  const handleLoadFromServer = async (filename: string) => {
    setLoadingServerBackup(filename);
    try {
      const payload = await loadBackupFromServer(filename);
      processLoadedBackup(payload, filename);
    } catch {
      setSnackbar({ open: true, message: 'Backup konnte nicht geladen werden', severity: 'error' });
    } finally {
      setLoadingServerBackup(null);
    }
  };

  // ── Vollständige Wiederherstellung ────────────────────────────────────────

  const handleFullRestore = async () => {
    if (!loadedBackup) return;
    setFullRestoreLoading(true);
    setFullRestoreConfirm(false);
    try {
      const response = await fetch('/api/setup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(loadedBackup),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBackupMessage({ type: 'success', text: 'Datenbank vollständig wiederhergestellt! Bitte neu anmelden.' });
      setTimeout(() => { localStorage.removeItem('token'); navigate('/login'); }, 2000);
    } catch (e: any) {
      setBackupMessage({ type: 'error', text: `Vollständige Wiederherstellung fehlgeschlagen: ${e.message}` });
    } finally {
      setFullRestoreLoading(false);
    }
  };

  // ── Selektive Wiederherstellung ───────────────────────────────────────────

  const buildFilters = (): RestoreFilters => {
    const allLocs = loadedBackup?.data?.locations ?? [];
    const resolvedLocationIds = vehicleFilterAll && locationFilterAll ? null
      : locationFilterAll ? null
      : selectedWarehouseIds.flatMap(wId => locationSubtree(wId, allLocs));

    return {
      targetBranchId: targetBranchId || null,
      vehicleIds: vehicleFilterAll ? null : selectedVehicleIds,
      locationIds: resolvedLocationIds,
    };
  };

  const handleSelectiveRestore = async () => {
    if (selectedSections.length === 0 || !loadedBackup) return;
    setSelectiveLoading(true);
    setConfirmDialog(false);
    try {
      await restoreSelective(loadedBackup, selectedSections, buildFilters());
      setBackupMessage({ type: 'success', text: `Erfolgreich wiederhergestellt: ${selectedSections.map(k => SECTIONS.find(s => s.key === k)?.label).join(', ')}` });
      setLoadedBackup(null);
      setAnalysis(null);
    } catch (e: any) {
      setBackupMessage({ type: 'error', text: `Wiederherstellung fehlgeschlagen: ${e.message}` });
    } finally {
      setSelectiveLoading(false);
    }
  };

  // ── Backup herunterladen ───────────────────────────────────────────────────

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      const response = await fetch('/api/setup/backup', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const backup = await response.json();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `lagerverwaltung-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setBackupMessage({ type: 'success', text: 'Backup erfolgreich heruntergeladen.' });
      await loadBackupFiles();
    } catch {
      setBackupMessage({ type: 'error', text: 'Backup fehlgeschlagen.' });
    } finally {
      setBackupLoading(false);
    }
  };

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────

  const vehicleLabel = (v: BackupVehicle) => v.licensePlate || v.identifier || v.name || v.id;
  const needsBranchSelector = analysis && (analysis.isMultiBranch || analysis.hasBranchlessLocations);
  const showVehicleFilter = selectedSections.some(k => SECTIONS.find(s => s.key === k)?.showVehicleFilter);
  const showLocationFilter = selectedSections.some(k => SECTIONS.find(s => s.key === k)?.showLocationFilter);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Backdrop open={fullRestoreLoading || selectiveLoading} sx={{ color: '#fff', zIndex: t => t.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography>Wiederherstellung läuft…</Typography>
      </Backdrop>

      <Typography variant="h4" gutterBottom>Datensicherung & Wiederherstellung</Typography>

      {backupMessage && (
        <Alert severity={backupMessage.type} sx={{ mb: 3 }} onClose={() => setBackupMessage(null)}>
          {backupMessage.text}
        </Alert>
      )}

      {/* ── Backup erstellen ─────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BackupIcon /> Backup erstellen
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Lädt ein vollständiges Backup aller Daten herunter (Artikel, Fahrzeuge, Benutzer, Bestände, Buchungen, Lagerorte, Niederlassungen …).
        </Typography>
        <Button
          variant="contained"
          onClick={handleDownloadBackup}
          disabled={backupLoading}
          startIcon={backupLoading ? <CircularProgress size={20} /> : <BackupIcon />}
        >
          {backupLoading ? 'Erstelle…' : 'Backup herunterladen'}
        </Button>
      </Paper>

      {/* ── Wiederherstellung ────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreIcon /> Wiederherstellung
        </Typography>

        {/* Schritt 1: Backup laden */}
        {!analysis ? (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Lade zuerst eine Backup-Datei – entweder von deinem Gerät oder aus der Serverliste unten.
              Danach kannst du genau auswählen, was wiederhergestellt werden soll.
            </Alert>
            <Button variant="outlined" component="label" startIcon={<LoadIcon />}>
              Backup-Datei auswählen
              <input type="file" accept=".json" hidden onChange={handleFileSelect} />
            </Button>
          </Box>
        ) : (
          <Box>
            {/* Backup-Analyse */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Geladenes Backup: {analysis.filename}
                </Typography>
                <Button size="small" onClick={() => { setLoadedBackup(null); setAnalysis(null); }}>
                  Anderes Backup laden
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {analysis.timestamp ? `Erstellt: ${new Date(analysis.timestamp).toLocaleString('de-DE')}` : ''}
                {' · '}Version {analysis.version}
              </Typography>

              {/* Niederlassungen */}
              {analysis.branches.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Niederlassungen:</Typography>
                  {analysis.branches.map(b => (
                    <Chip key={b.id} label={b.name} size="small" icon={<BranchIcon />} color="primary" variant="outlined" />
                  ))}
                </Box>
              )}

              {/* Datenmenge */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {SECTIONS.filter(s => (analysis.counts[s.key] ?? 0) > 0).map(s => (
                  <Chip key={s.key} label={`${s.label}: ${analysis.counts[s.key]}`} size="small" variant="outlined" />
                ))}
              </Box>

              {analysis.hasBranchlessLocations && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Dieses Backup enthält Lagerorte ohne Niederlassungs-Zuordnung (älteres Format).
                  Bitte wähle unten eine Zielniederlassung aus.
                </Alert>
              )}
            </Paper>

            {/* ── Vollständige Wiederherstellung ── */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="error" fontSize="small" />
                  <Typography fontWeight="medium">Vollständige Wiederherstellung (ALLES überschreiben)</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Alert severity="error" sx={{ mb: 2 }}>
                  <strong>ACHTUNG:</strong> Löscht ALLE aktuellen Daten unwiderruflich und ersetzt sie durch das Backup!
                </Alert>
                <Button variant="contained" color="error" startIcon={<RestoreIcon />} onClick={() => setFullRestoreConfirm(true)}>
                  Vollständig wiederherstellen
                </Button>
              </AccordionDetails>
            </Accordion>

            <Divider sx={{ my: 2 }} />

            {/* ── Selektive Wiederherstellung ── */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Selektive Wiederherstellung
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wähle genau aus, was wiederhergestellt werden soll. Nicht gewählte Daten bleiben unverändert.
            </Typography>

            {/* Niederlassungs-Selector */}
            {needsBranchSelector && analysis.branches.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Zielniederlassung</InputLabel>
                  <Select
                    value={targetBranchId}
                    label="Zielniederlassung"
                    onChange={e => setTargetBranchId(e.target.value)}
                  >
                    {analysis.isMultiBranch && <MenuItem value=""><em>Alle Niederlassungen</em></MenuItem>}
                    {analysis.branches.map(b => (
                      <MenuItem key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {analysis.isMultiBranch
                    ? 'Nur Daten dieser Niederlassung werden wiederhergestellt.'
                    : 'Lagerorte ohne Niederlassung werden dieser zugewiesen.'}
                </Typography>
              </Box>
            )}

            {/* Bereiche */}
            <FormGroup>
              {SECTIONS.map(section => {
                const count = analysis.counts[section.key] ?? 0;
                const isChecked = selectedSections.includes(section.key);
                return (
                  <Box key={section.key} sx={{ mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={e => setSelectedSections(prev =>
                            e.target.checked ? [...prev, section.key] : prev.filter(k => k !== section.key)
                          )}
                          disabled={selectiveLoading}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight="medium">{section.label}</Typography>
                          <Typography variant="caption" color="text.secondary">— {section.description}</Typography>
                          <Chip
                            label={count === 0 ? 'leer' : count}
                            size="small"
                            color={count === 0 ? 'default' : 'primary'}
                            variant="outlined"
                            sx={{ fontSize: 11 }}
                          />
                        </Box>
                      }
                    />
                    {isChecked && section.dependsOn && (
                      <Alert severity="info" sx={{ ml: 4, py: 0, fontSize: 12 }}>
                        Voraussetzung: {section.dependsOn}
                      </Alert>
                    )}
                  </Box>
                );
              })}
            </FormGroup>

            {/* Fahrzeugfilter */}
            {showVehicleFilter && analysis.vehicles.length > 0 && (
              <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <VehicleIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Fahrzeugfilter</Typography>
                  <Typography variant="caption" color="text.secondary">(gilt für Bestände & Buchungshistorie)</Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={vehicleFilterAll} onChange={e => setVehicleFilterAll(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Alle Fahrzeuge</Typography>}
                />
                {!vehicleFilterAll && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {analysis.vehicles.map(v => (
                      <Chip
                        key={v.id}
                        label={vehicleLabel(v)}
                        size="small"
                        clickable
                        color={selectedVehicleIds.includes(v.id) ? 'primary' : 'default'}
                        onClick={() => setSelectedVehicleIds(prev =>
                          prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id]
                        )}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Lagerortfilter */}
            {showLocationFilter && analysis.topLevelLocations.length > 0 && (
              <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <WarehouseIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Lagerfilter</Typography>
                  <Typography variant="caption" color="text.secondary">(gilt für Artikel & lagerbasierte Bestände)</Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={locationFilterAll} onChange={e => setLocationFilterAll(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Alle Lager</Typography>}
                />
                {!locationFilterAll && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {analysis.topLevelLocations.map(loc => (
                      <Chip
                        key={loc.id}
                        label={loc.name || loc.code}
                        size="small"
                        clickable
                        color={selectedWarehouseIds.includes(loc.id) ? 'primary' : 'default'}
                        onClick={() => setSelectedWarehouseIds(prev =>
                          prev.includes(loc.id) ? prev.filter(id => id !== loc.id) : [...prev, loc.id]
                        )}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Zusammenfassung & Bestätigung */}
            {selectedSections.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>Folgende Bereiche werden gelöscht und neu befüllt:</strong>{' '}
                {selectedSections.map(k => SECTIONS.find(s => s.key === k)?.label).join(', ')}
                {!vehicleFilterAll && selectedVehicleIds.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>Fahrzeug-Filter: {selectedVehicleIds.length} Fahrzeug(e) ausgewählt</Box>
                )}
                {!locationFilterAll && selectedWarehouseIds.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>Lager-Filter: {selectedWarehouseIds.length} Lager ausgewählt</Box>
                )}
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="warning"
                disabled={selectedSections.length === 0 || selectiveLoading || (!vehicleFilterAll && selectedVehicleIds.length === 0) || (!locationFilterAll && selectedWarehouseIds.length === 0)}
                onClick={() => setConfirmDialog(true)}
                startIcon={<RestoreIcon />}
              >
                {selectedSections.length === 0
                  ? 'Bereiche auswählen'
                  : `${selectedSections.length} Bereich${selectedSections.length !== 1 ? 'e' : ''} wiederherstellen`}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ── Auto-Backup ──────────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Automatisches Backup</Typography>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Switch
              checked={autoConfig.enabled}
              onChange={e => setAutoConfig(c => ({ ...c, enabled: e.target.checked }))}
              disabled={configLoading || savingConfig}
            />
            <Typography>Aktiviert</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={!autoConfig.enabled || savingConfig}>
            <InputLabel>Frequenz</InputLabel>
            <Select label="Frequenz" value={autoConfig.frequency} onChange={e => setAutoConfig(c => ({ ...c, frequency: e.target.value as any }))}>
              <MenuItem value="daily">Täglich</MenuItem>
              <MenuItem value="weekly">Wöchentlich</MenuItem>
              <MenuItem value="monthly">Monatlich</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small" label="Uhrzeit" type="time" value={autoConfig.time}
            onChange={e => setAutoConfig(c => ({ ...c, time: e.target.value }))}
            disabled={!autoConfig.enabled || savingConfig}
            inputProps={{ step: 300 }}
          />
          <TextField
            size="small" label="Aufbewahrung (Tage)" type="number"
            value={autoConfig.retentionDays || 30}
            onChange={e => setAutoConfig(c => ({ ...c, retentionDays: Math.max(1, Math.min(365, Number(e.target.value) || 30)) }))}
            disabled={!autoConfig.enabled || savingConfig}
            inputProps={{ min: 1, max: 365 }}
            sx={{ width: 160 }}
          />
          <Button variant="contained" disabled={savingConfig} onClick={async () => {
            setSavingConfig(true);
            try {
              const [h, m] = autoConfig.time.split(':').map(Number);
              const d = new Date(); d.setHours(h, m, 0, 0);
              const utcTime = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
              await setAutoBackupConfig({ enabled: autoConfig.enabled, frequency: autoConfig.frequency, time: utcTime, retentionDays: autoConfig.retentionDays });
              setSnackbar({ open: true, message: 'Gespeichert', severity: 'success' });
            } catch { setSnackbar({ open: true, message: 'Fehler beim Speichern', severity: 'error' }); }
            finally { setSavingConfig(false); }
          }}>Speichern</Button>
        </Box>
        <Alert severity={autoConfig.enabled ? 'success' : 'info'}>
          {autoConfig.enabled
            ? `Aktiv: ${autoConfig.frequency} um ${autoConfig.time} (${autoConfig.retentionDays || 30} Tage)`
            : 'Automatische Backups sind deaktiviert.'}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Letztes automatisches Backup: {autoConfig.lastBackup ? new Date(autoConfig.lastBackup).toLocaleString('de-DE') : 'Noch keines'}
        </Typography>
      </Paper>

      {/* ── Gespeicherte Backups ─────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Gespeicherte Backups (Server)</Typography>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadBackupFiles} disabled={loadingFiles}>
            Aktualisieren
          </Button>
        </Box>
        {loadingFiles ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
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
                {backupFiles.map(file => (
                  <TableRow key={file.filename} hover>
                    <TableCell>{file.type === 'manual' ? 'Manuell' : 'Automatisch'}</TableCell>
                    <TableCell>{file.filename}</TableCell>
                    <TableCell align="right">{(file.size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell align="right">{new Date(file.created).toLocaleString('de-DE')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Für Wiederherstellung laden">
                        <IconButton
                          color="warning"
                          size="small"
                          disabled={loadingServerBackup === file.filename}
                          onClick={() => handleLoadFromServer(file.filename)}
                        >
                          {loadingServerBackup === file.filename ? <CircularProgress size={18} /> : <RestoreIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Herunterladen">
                        <IconButton color="primary" size="small" onClick={async () => {
                          try {
                            const blob = await downloadAutoBackup(file.filename);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = file.filename;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch { setSnackbar({ open: true, message: 'Fehler beim Herunterladen', severity: 'error' }); }
                        }}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton color="error" size="small" onClick={() => setDeleteDialog({ open: true, filename: file.filename })}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Dialoge ──────────────────────────────────────────────────────── */}

      {/* Vollständige Wiederherstellung bestätigen */}
      <Dialog open={fullRestoreConfirm} onClose={() => setFullRestoreConfirm(false)}>
        <DialogTitle>Vollständige Wiederherstellung</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>ACHTUNG:</strong> Alle aktuellen Daten werden unwiderruflich gelöscht und durch das Backup ersetzt!
          </Alert>
          <DialogContentText>
            Das schließt alle Artikel, Fahrzeuge, Bestände, Benutzer, Lagerorte, Buchungen und Einstellungen ein.
            Bist du absolut sicher?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFullRestoreConfirm(false)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleFullRestore}>Ja, alles wiederherstellen</Button>
        </DialogActions>
      </Dialog>

      {/* Selektive Wiederherstellung bestätigen */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle>Wiederherstellung bestätigen</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Folgende Bereiche werden gelöscht und aus dem Backup neu befüllt:
          </DialogContentText>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedSections.map(k => (
              <Chip key={k} label={SECTIONS.find(s => s.key === k)?.label} color="warning" size="small" />
            ))}
          </Box>
          {!vehicleFilterAll && selectedVehicleIds.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Fahrzeug-Filter: {selectedVehicleIds.length} Fahrzeug(e)
            </Typography>
          )}
          {!locationFilterAll && selectedWarehouseIds.length > 0 && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Lager-Filter: {selectedWarehouseIds.length} Lager
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>Abbrechen</Button>
          <Button color="warning" variant="contained" onClick={handleSelectiveRestore}>
            Jetzt wiederherstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup löschen bestätigen */}
      <Dialog open={deleteDialog.open} onClose={() => !deletingFile && setDeleteDialog({ open: false, filename: null })}>
        <DialogTitle>Backup löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>Backup „{deleteDialog.filename}" wirklich löschen?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, filename: null })} disabled={deletingFile}>Abbrechen</Button>
          <Button color="error" disabled={deletingFile} onClick={async () => {
            if (!deleteDialog.filename) return;
            setDeletingFile(true);
            try {
              await deleteAutoBackup(deleteDialog.filename);
              setSnackbar({ open: true, message: 'Backup gelöscht', severity: 'success' });
              setDeleteDialog({ open: false, filename: null });
              await loadBackupFiles();
            } catch { setSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' }); }
            finally { setDeletingFile(false); }
          }}>
            {deletingFile ? <CircularProgress size={20} /> : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} message={snackbar.message} />
    </Container>
  );
};

export default BackupPage;
