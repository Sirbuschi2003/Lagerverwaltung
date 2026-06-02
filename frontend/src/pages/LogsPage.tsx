import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Tune as TuneIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  ShoppingCart as ShoppingCartIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  DirectionsCar as DirectionsCarIcon,
  Block as BlockIcon,
  Warning as WarningIcon,
  Build as BuildIcon,
  MoreHoriz as MoreHorizIcon,
  Search as SearchIcon,
  FiberManualRecord as LiveDotIcon,
  StopCircle as StopIcon,
} from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
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
import useAuthStore from '../store/useAuthStore';

// ─── Activity formatting ──────────────────────────────────────────────────────

interface ActivityInfo {
  avatarBg: string;
  icon: React.ReactElement;
  primary: string;
  secondary?: string;
}

function formatActivity(log: LogEntry, theme: any): ActivityInfo {
  const m = log.metadata || {};
  const who = log.username ? log.username : 'System';
  const cat = log.category || '';
  const action = (log.action || '').toUpperCase();

  // STOCK – Buchungen
  if (cat === 'STOCK') {
    const item = m.itemDescription || m.itemName || m.itemCode || 'Artikel';
    const code = m.itemCode ? ` (${m.itemCode})` : '';
    const qty = m.quantity != null ? `${m.quantity}×` : '';
    const vehicle = m.vehicleName || m.vehicle || '';
    const vehicleStr = vehicle ? ` — ${vehicle}` : '';

    if (action.includes('OUT') || action.includes('CHECKOUT')) {
      return {
        avatarBg: theme.palette.error.main,
        icon: <ArrowDownwardIcon fontSize="small" />,
        primary: `${who} hat ${qty} ${item}${code} ausgebucht`,
        secondary: vehicle ? `Fahrzeug: ${vehicle}` : undefined,
      };
    }
    if (action.includes('IN') || action.includes('CHECKIN')) {
      return {
        avatarBg: theme.palette.success.main,
        icon: <ArrowUpwardIcon fontSize="small" />,
        primary: `${who} hat ${qty} ${item}${code} eingebucht`,
        secondary: vehicle ? `Fahrzeug: ${vehicle}` : (m.note || undefined),
      };
    }
    if (action.includes('ADJUST')) {
      return {
        avatarBg: theme.palette.info.main,
        icon: <TuneIcon fontSize="small" />,
        primary: `${who} hat Bestand von ${item}${code} korrigiert`,
        secondary: m.note || (vehicle ? `Fahrzeug: ${vehicle}` : undefined),
      };
    }
    return {
      avatarBg: theme.palette.info.main,
      icon: <TuneIcon fontSize="small" />,
      primary: `Lagerbewegung: ${item}${code}${vehicleStr}`,
      secondary: log.action,
    };
  }

  // AUTH – Anmeldungen
  if (cat === 'AUTH') {
    if (action.includes('LOGOUT')) {
      return {
        avatarBg: theme.palette.text.secondary,
        icon: <LogoutIcon fontSize="small" />,
        primary: `${who} hat sich abgemeldet`,
      };
    }
    if (action.includes('FAIL') || action.includes('INVALID')) {
      return {
        avatarBg: theme.palette.warning.main,
        icon: <BlockIcon fontSize="small" />,
        primary: `Fehlgeschlagene Anmeldung${m.username ? ` für „${m.username}"` : ''}`,
        secondary: m.ipAddress || log.ipAddress,
      };
    }
    return {
      avatarBg: theme.palette.grey[600],
      icon: <LoginIcon fontSize="small" />,
      primary: `${who} hat sich angemeldet`,
      secondary: m.ipAddress || log.ipAddress,
    };
  }

  // PURCHASE – Bestellungen
  if (cat === 'PURCHASE') {
    const supplier = m.supplierName || m.supplier || '';
    const orderNum = m.orderNumber || m.orderId ? ` #${m.orderNumber || m.orderId}` : '';
    const items = m.itemCount != null ? ` (${m.itemCount} Pos.)` : '';
    if (action.includes('CREATED') || action.includes('CREATE')) {
      return {
        avatarBg: theme.palette.warning.main,
        icon: <ReceiptIcon fontSize="small" />,
        primary: `${who} hat Bestellung${orderNum} erstellt${items}`,
        secondary: supplier ? `Lieferant: ${supplier}` : undefined,
      };
    }
    if (action.includes('ORDERED') || action.includes('SENT')) {
      return {
        avatarBg: theme.palette.warning.dark,
        icon: <ReceiptIcon fontSize="small" />,
        primary: `${who} hat Bestellung${orderNum} aufgegeben${items}`,
        secondary: supplier ? `Lieferant: ${supplier}` : undefined,
      };
    }
    if (action.includes('RECEIVED') || action.includes('ARCHIVED')) {
      return {
        avatarBg: theme.palette.success.dark,
        icon: <ReceiptIcon fontSize="small" />,
        primary: `Bestellung${orderNum} abgeschlossen${items}`,
        secondary: supplier ? `Lieferant: ${supplier}` : undefined,
      };
    }
    return {
      avatarBg: theme.palette.warning.main,
      icon: <ReceiptIcon fontSize="small" />,
      primary: `Bestellung${orderNum}${items}`,
      secondary: log.action,
    };
  }

  // INVENTORY – Inventur
  if (cat === 'INVENTORY') {
    const sessionId = m.sessionId ? ` (${String(m.sessionId).slice(0, 8)}…)` : '';
    if (action.includes('START') || action.includes('CREATE')) {
      return {
        avatarBg: theme.palette.secondary.main,
        icon: <AssignmentIcon fontSize="small" />,
        primary: `${who} hat eine Inventur gestartet${sessionId}`,
      };
    }
    if (action.includes('FINAL')) {
      return {
        avatarBg: theme.palette.secondary.dark,
        icon: <AssignmentIcon fontSize="small" />,
        primary: `${who} hat Inventur abgeschlossen${sessionId}`,
      };
    }
    if (action.includes('DELETE') || action.includes('DELET')) {
      return {
        avatarBg: theme.palette.error.main,
        icon: <AssignmentIcon fontSize="small" />,
        primary: `Inventur gelöscht${sessionId}`,
        secondary: m.reason,
      };
    }
    return {
      avatarBg: theme.palette.secondary.main,
      icon: <AssignmentIcon fontSize="small" />,
      primary: `Inventur-Aktion${sessionId}`,
      secondary: log.action,
    };
  }

  // RESTOCK – Nachbestellanfragen
  if (cat === 'RESTOCK') {
    const item = m.itemDescription || m.itemName || m.itemCode || 'Artikel';
    const code = m.itemCode ? ` (${m.itemCode})` : '';
    if (action.includes('REQUEST') || action.includes('CREATE')) {
      return {
        avatarBg: theme.palette.warning.light,
        icon: <ShoppingCartIcon fontSize="small" />,
        primary: `${who} hat Nachbestellung für ${item}${code} angefordert`,
        secondary: m.quantity != null ? `Menge: ${m.quantity}` : undefined,
      };
    }
    if (action.includes('FULFILL') || action.includes('DONE')) {
      return {
        avatarBg: theme.palette.success.main,
        icon: <ShoppingCartIcon fontSize="small" />,
        primary: `Nachbestellung für ${item}${code} erledigt`,
      };
    }
    return {
      avatarBg: '#f59e0b',
      icon: <ShoppingCartIcon fontSize="small" />,
      primary: `Nachbestellung: ${item}${code}`,
      secondary: log.action,
    };
  }

  // USER – Benutzerverwaltung
  if (cat === 'USER') {
    const target = m.targetUsername || m.targetUser || '';
    if (action.includes('CREATE')) {
      return {
        avatarBg: theme.palette.info.dark,
        icon: <PersonIcon fontSize="small" />,
        primary: `${who} hat Benutzer${target ? ` „${target}"` : ''} erstellt`,
      };
    }
    if (action.includes('UPDATE') || action.includes('EDIT')) {
      return {
        avatarBg: theme.palette.info.main,
        icon: <PersonIcon fontSize="small" />,
        primary: `${who} hat Benutzer${target ? ` „${target}"` : ''} bearbeitet`,
      };
    }
    if (action.includes('DELETE')) {
      return {
        avatarBg: theme.palette.error.main,
        icon: <PersonIcon fontSize="small" />,
        primary: `${who} hat Benutzer${target ? ` „${target}"` : ''} gelöscht`,
      };
    }
    if (action.includes('PASS') || action.includes('PWD')) {
      return {
        avatarBg: theme.palette.warning.main,
        icon: <PersonIcon fontSize="small" />,
        primary: `${who} hat Passwort geändert${target ? ` für „${target}"` : ''}`,
      };
    }
    return {
      avatarBg: theme.palette.info.main,
      icon: <PersonIcon fontSize="small" />,
      primary: `Benutzer-Aktion${target ? ` für „${target}"` : ''}`,
      secondary: log.action,
    };
  }

  // EMAIL
  if (cat === 'EMAIL') {
    const recipient = m.to || m.recipient || '';
    return {
      avatarBg: theme.palette.primary.main,
      icon: <EmailIcon fontSize="small" />,
      primary: `E-Mail versendet${recipient ? ` an ${recipient}` : ''}`,
      secondary: m.subject,
    };
  }

  // VEHICLE
  if (cat === 'VEHICLE') {
    const vehicle = m.vehicleName || m.name || '';
    if (action.includes('CREATE')) {
      return {
        avatarBg: theme.palette.primary.dark,
        icon: <DirectionsCarIcon fontSize="small" />,
        primary: `${who} hat Fahrzeug${vehicle ? ` „${vehicle}"` : ''} angelegt`,
      };
    }
    return {
      avatarBg: theme.palette.primary.main,
      icon: <DirectionsCarIcon fontSize="small" />,
      primary: `Fahrzeug${vehicle ? ` „${vehicle}"` : ''}`,
      secondary: log.action,
    };
  }

  // SYSTEM
  if (cat === 'SYSTEM') {
    if (action.includes('UPDATE')) {
      return {
        avatarBg: theme.palette.success.main,
        icon: <BuildIcon fontSize="small" />,
        primary: 'System-Update durchgeführt',
        secondary: m.version,
      };
    }
    if (action.includes('BACKUP')) {
      return {
        avatarBg: theme.palette.info.main,
        icon: <BuildIcon fontSize="small" />,
        primary: `${who} hat Daten-Backup erstellt`,
      };
    }
    return {
      avatarBg: theme.palette.grey[500],
      icon: <SettingsIcon fontSize="small" />,
      primary: log.action || 'System-Ereignis',
      secondary: m.details,
    };
  }

  // Fallback
  return {
    avatarBg: theme.palette.grey[400],
    icon: <MoreHorizIcon fontSize="small" />,
    primary: log.action || `${cat} — Ereignis`,
    secondary: undefined,
  };
}

// ─── Day label helper ──────────────────────────────────────────────────────────

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const toDay = (x: Date) => x.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });

  if (toDay(d) === toDay(today)) return 'Heute';
  if (toDay(d) === toDay(yesterday)) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function getDayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE');
}

// ─── Category chip config ──────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { label: 'Alle', value: '' },
  { label: 'Buchungen', value: 'STOCK' },
  { label: 'Bestellungen', value: 'PURCHASE' },
  { label: 'Inventur', value: 'INVENTORY' },
  { label: 'Nachbestellungen', value: 'RESTOCK' },
  { label: 'Anmeldungen', value: 'AUTH' },
  { label: 'Benutzer', value: 'USER' },
  { label: 'System', value: 'SYSTEM' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const LogsPage: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = !user?.branchId;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [logFilters, setLogFilters] = useState<LogFilters>({ limit: 50, offset: 0 });
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchText, setSearchText] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const liveIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [showDetails, setShowDetails] = useState<LogEntry | null>(null);
  const [retentionDays, setRetentionDaysState] = useState<number>(90);
  const [savingRetention, setSavingRetention] = useState(false);
  const [busyDeleteAll, setBusyDeleteAll] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const loadLogs = useCallback(async (filters: LogFilters, append = false) => {
    setLoading(true);
    try {
      const response = await getLogs(filters);
      setLogs(prev => append ? [...prev, ...response.logs] : response.logs);
      setTotalLogs(response.total);
      setHasMore((filters.offset || 0) + response.logs.length < response.total);
    } catch (e) {
      console.error('Fehler beim Laden der Logs:', e);
    }
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const stats = await getLogStats();
      setLogStats(stats);
    } catch (e) {
      console.error('Fehler beim Laden der Statistiken:', e);
    }
  }, []);

  useEffect(() => {
    loadLogs(logFilters);
  }, [logFilters]);

  useEffect(() => {
    loadStats();
    (async () => {
      try {
        const res = await getLogRetention();
        if (res?.retentionDays) setRetentionDaysState(res.retentionDays);
      } catch (e) {}
    })();
  }, []);

  // Live-Modus: alle 5s neu laden (nur erste Seite, kein append)
  const toggleLive = () => {
    if (liveMode) {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
      setLiveMode(false);
    } else {
      setLiveMode(true);
      liveIntervalRef.current = setInterval(() => {
        setLogFilters(f => ({ ...f, offset: 0 }));
      }, 5000);
    }
  };

  React.useEffect(() => {
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, []);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSearchText('');
    setLogFilters({ limit: 50, offset: 0, category: cat || undefined });
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    setLogFilters({ limit: 50, offset: 0, category: selectedCategory || undefined, action: text || undefined });
  };

  const handleLoadMore = () => {
    loadLogs({ ...logFilters, offset: (logFilters.offset || 0) + 50 }, true);
  };

  const handleRefresh = () => {
    const resetFilters = { ...logFilters, offset: 0 };
    setLogFilters(resetFilters);
  };

  const handleDownload = async (format: 'csv' | 'json') => {
    try {
      const blob = format === 'csv'
        ? await downloadLogsCSV(logFilters)
        : await downloadLogsJSON(logFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Fehler beim Download:', e);
    }
  };

  // Group logs by day
  const grouped: { dayKey: string; dayLabel: string; entries: LogEntry[] }[] = [];
  logs.forEach((log) => {
    const key = getDayKey(log.timestamp);
    const last = grouped[grouped.length - 1];
    if (last && last.dayKey === key) {
      last.entries.push(log);
    } else {
      grouped.push({ dayKey: key, dayLabel: getDayLabel(log.timestamp), entries: [log] });
    }
  });

  return (
    <Container maxWidth={isEmbedded ? 'lg' : 'xl'} sx={{ mt: isEmbedded ? 0 : 4, mb: 4 }}>
      {!isEmbedded && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Systemprotokoll
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aktivitäten und Ereignisse im Überblick
          </Typography>
        </Box>
      )}

      {/* Statistik-Chips */}
      {logStats && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
          <Chip label={`${logStats.totalLogs?.toLocaleString() || 0} gesamt`} size="small" />
          {(logStats.byLevel?.ERROR || 0) > 0 && (
            <Chip icon={<WarningIcon />} label={`${logStats.byLevel.ERROR} Fehler`} size="small" color="error" variant="outlined" />
          )}
          {(logStats.byLevel?.WARNING || 0) > 0 && (
            <Chip icon={<WarningIcon />} label={`${logStats.byLevel.WARNING} Warnungen`} size="small" color="warning" variant="outlined" />
          )}
          {(logStats.byLevel?.SECURITY || 0) > 0 && (
            <Chip icon={<BlockIcon />} label={`${logStats.byLevel.SECURITY} Sicherheit`} size="small" color="secondary" variant="outlined" />
          )}
        </Stack>
      )}

      {/* Kategoriefilter + Suche + Aktionen */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Suchen (Aktion, Benutzer…)"
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <Tooltip title={liveMode ? 'Live-Modus stoppen' : 'Live-Modus starten (aktualisiert alle 5s)'}>
              <Button
                size="small"
                variant={liveMode ? 'contained' : 'outlined'}
                color={liveMode ? 'error' : 'primary'}
                startIcon={liveMode ? <StopIcon /> : <LiveDotIcon sx={{ color: liveMode ? undefined : 'error.main' }} />}
                onClick={toggleLive}
              >
                {liveMode ? 'Live stoppen' : 'Live'}
              </Button>
            </Tooltip>
            <Tooltip title="Aktualisieren">
              <IconButton size="small" onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownload('csv')}>CSV</Button>
            <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownload('json')}>JSON</Button>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {CATEGORY_FILTERS.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                size="small"
                onClick={() => handleCategoryChange(f.value)}
                color={selectedCategory === f.value ? 'primary' : 'default'}
                variant={selectedCategory === f.value ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      {/* Activity Feed */}
      <Paper sx={{ mb: 2 }}>
        {loading && logs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Keine Einträge gefunden</Typography>
          </Box>
        ) : (
          <>
            {grouped.map((group, gi) => (
              <Box key={group.dayKey}>
                {/* Day header */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    borderTop: gi > 0 ? `1px solid ${theme.palette.divider}` : 'none',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {group.dayLabel}
                  </Typography>
                </Box>

                <List disablePadding>
                  {group.entries.map((log, idx) => {
                    const info = formatActivity(log, theme);
                    const isLast = idx === group.entries.length - 1;
                    const isError = log.level === 'ERROR';
                    const isWarning = log.level === 'WARNING';
                    const isSecurity = log.level === 'SECURITY';
                    const rowBg = isError
                      ? alpha(theme.palette.error.main, 0.05)
                      : isWarning
                      ? alpha(theme.palette.warning.main, 0.04)
                      : isSecurity
                      ? alpha(theme.palette.secondary.main, 0.05)
                      : undefined;

                    return (
                      <React.Fragment key={log.id}>
                        <ListItem
                          alignItems="flex-start"
                          sx={{
                            px: 2.5,
                            py: 1.25,
                            bgcolor: rowBg,
                            '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.06) },
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowDetails(log)}
                          secondaryAction={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 45, textAlign: 'right' }}>
                                {new Date(log.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                              <Tooltip title="Details">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setShowDetails(log); }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          }
                        >
                          <ListItemAvatar sx={{ minWidth: 44 }}>
                            <Avatar sx={{ width: 34, height: 34, bgcolor: info.avatarBg, fontSize: 16 }}>
                              {info.icon}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pr: 8 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {info.primary}
                                </Typography>
                                {isError && <Chip label="Fehler" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                                {isWarning && <Chip label="Warnung" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                                {isSecurity && <Chip label="Sicherheit" size="small" color="secondary" sx={{ height: 18, fontSize: 10 }} />}
                              </Box>
                            }
                            secondary={
                              info.secondary ? (
                                <Typography variant="caption" color="text.secondary">
                                  {info.secondary}
                                </Typography>
                              ) : undefined
                            }
                          />
                        </ListItem>
                        {!isLast && <Divider component="li" sx={{ ml: '68px' }} />}
                      </React.Fragment>
                    );
                  })}
                </List>
              </Box>
            ))}

            {/* Load more */}
            <Box sx={{ p: 2, textAlign: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
              {loading ? (
                <CircularProgress size={24} />
              ) : hasMore ? (
                <Button variant="text" onClick={handleLoadMore}>
                  Weitere laden ({totalLogs - logs.length} verbleibend)
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Alle {totalLogs} Einträge geladen
                </Typography>
              )}
            </Box>
          </>
        )}
      </Paper>

      {/* Log-Verwaltung: nur Super-Admin */}
      {isSuperAdmin && <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={600}>
              Log-Verwaltung
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap>
            <TextField
              type="number"
              size="small"
              label="Aufbewahrung (Tage)"
              value={retentionDays}
              onChange={(e) => setRetentionDaysState(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 3650 }}
              sx={{ width: 200 }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={savingRetention}
              onClick={async () => {
                try {
                  setSavingRetention(true);
                  const res = await setLogRetention(retentionDays);
                  setSnackbar({ open: true, message: `Aufbewahrung gespeichert: ${res.retentionDays} Tage` });
                } catch {
                  setSnackbar({ open: true, message: 'Fehler beim Speichern der Aufbewahrung' });
                } finally {
                  setSavingRetention(false);
                }
              }}
            >
              Speichern
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              onClick={async () => {
                try {
                  const res = await cleanupOldLogs(retentionDays);
                  setSnackbar({ open: true, message: `${res.deletedCount} alte Logs gelöscht (> ${res.daysToKeep} Tage)` });
                  await Promise.all([loadLogs({ ...logFilters, offset: 0 }), loadStats()]);
                } catch {
                  setSnackbar({ open: true, message: 'Fehler beim Bereinigen alter Logs' });
                }
              }}
            >
              Alte Logs bereinigen
            </Button>
            <Button
              variant="contained"
              size="small"
              color="error"
              disabled={busyDeleteAll}
              onClick={async () => {
                if (!window.confirm('Wirklich ALLE Logs löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
                try {
                  setBusyDeleteAll(true);
                  const res = await deleteAllLogs();
                  setSnackbar({ open: true, message: `Alle Logs gelöscht (${res.deletedCount})` });
                  await Promise.all([loadLogs({ ...logFilters, offset: 0 }), loadStats()]);
                } catch {
                  setSnackbar({ open: true, message: 'Fehler beim Löschen aller Logs' });
                } finally {
                  setBusyDeleteAll(false);
                }
              }}
            >
              Alle Logs löschen
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>}

      {/* Detail-Dialog */}
      <Dialog open={!!showDetails} onClose={() => setShowDetails(null)} maxWidth="md" fullWidth>
        <DialogTitle>Ereignis-Details</DialogTitle>
        <DialogContent dividers>
          {showDetails && (
            <Stack spacing={1.5}>
              {[
                ['Zeitstempel', new Date(showDetails.timestamp).toLocaleString('de-DE')],
                ['Kategorie', showDetails.category],
                ['Aktion', showDetails.action],
                ['Level', showDetails.level],
                ['Quelle', showDetails.source || '-'],
                ['Benutzer', showDetails.username || '-'],
                ['IP-Adresse', showDetails.ipAddress || '-'],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, fontWeight: 600 }}>
                    {label}
                  </Typography>
                  <Typography variant="body2">{value}</Typography>
                </Box>
              ))}

              {showDetails.details && (
                <>
                  <Divider />
                  <Typography variant="body2" fontWeight={600}>Details</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, m: 0 }}>
                      {typeof showDetails.details === 'string'
                        ? showDetails.details
                        : JSON.stringify(showDetails.details, null, 2)}
                    </Typography>
                  </Paper>
                </>
              )}

              {showDetails.metadata && Object.keys(showDetails.metadata).length > 0 && (
                <>
                  <Divider />
                  <Typography variant="body2" fontWeight={600}>Metadaten</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, m: 0 }}>
                      {JSON.stringify(showDetails.metadata, null, 2)}
                    </Typography>
                  </Paper>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(null)}>Schließen</Button>
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

export default LogsPage;
