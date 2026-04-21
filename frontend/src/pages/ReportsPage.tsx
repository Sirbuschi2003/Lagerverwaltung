import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Edit as EditIcon,
  Refresh as RefreshIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  BarChart as BarChartIcon,
  FileDownload as FileDownloadIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from "@mui/icons-material";

import {
  fetchSlowMovers,
  fetchSlowMoverSettings,
  saveSlowMoverSettings,
  fetchConsumptionTrend,
  fetchArticleActivity,
  fetchWarehouses,
  type SlowMoverRow,
  type ConsumptionTrendEntry,
  type ArticleActivityRow,
  type LocationDto,
} from "../utils/api";
import useAuthStore from "../store/useAuthStore";
import useItemsStore from "../store/useItemsStore";

// ── Datum-Helfer ──────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const presets = [
  { label: "30 Tage", days: 30 },
  { label: "90 Tage", days: 90 },
  { label: "6 Monate", days: 180 },
  { label: "1 Jahr", days: 365 },
];

const getPresetRange = (days: number) => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: toDateStr(from), to: toDateStr(to) };
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ── CSV-Export ────────────────────────────────────────────────────────────────

const exportCsv = (rows: ArticleActivityRow[], from: string, to: string) => {
  const header = ["Artikelnummer", "Bezeichnung", "Bezeichnung 2", "Hersteller", "Produktgruppe",
    "Entnahmen (Anz.)", "Entnahmen (Menge)", "Eingänge (Anz.)", "Eingänge (Menge)", "Letzte Bewegung"];
  const lines = rows.map((r) => [
    r.code, r.description, r.descriptionSecondary ?? "",
    r.manufacturer ?? "", r.productGroup ?? "",
    r.checkoutCount, r.checkoutQty, r.checkinCount, r.checkinQty,
    formatDate(r.lastMovementAt),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));

  const csv = "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artikel_auswertung_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Slow-Mover Tab ────────────────────────────────────────────────────────────

const getDaysSeverity = (days: number | null): "error" | "warning" | "info" | "default" => {
  if (days === null) return "error";
  if (days >= 365) return "error";
  if (days >= 180) return "warning";
  return "info";
};

const SlowMoverTab: React.FC<{ warehouseId?: string }> = ({ warehouseId }) => {
  const { user } = useAuthStore();
  const isManager = user?.role === "MANAGER";

  const [rows, setRows] = useState<SlowMoverRow[]>([]);
  const [threshold, setThreshold] = useState<number>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterNoStock, setFilterNoStock] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editDays, setEditDays] = useState<number>(90);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, data] = await Promise.all([fetchSlowMoverSettings(), fetchSlowMovers(undefined, warehouseId)]);
      setThreshold(settings.days);
      setEditDays(settings.days);
      setRows(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const saved = await saveSlowMoverSettings(editDays);
      setThreshold(saved.days);
      setSettingsOpen(false);
      setLoading(true);
      const data = await fetchSlowMovers(saved.days, warehouseId);
      setRows(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const manufacturers = useMemo(() => {
    const set = new Set(rows.map((r) => r.manufacturer).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const productGroups = useMemo(() => {
    const set = new Set(rows.map((r) => r.productGroup).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((row) => {
      if (filterNoStock && row.totalQuantity > 0) return false;
      if (filterManufacturer && row.manufacturer !== filterManufacturer) return false;
      if (filterGroup && row.productGroup !== filterGroup) return false;
      if (q) {
        return (
          row.code.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          (row.descriptionSecondary ?? "").toLowerCase().includes(q) ||
          (row.manufacturer ?? "").toLowerCase().includes(q) ||
          (row.productGroup ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, filterManufacturer, filterGroup, filterNoStock]);

  const hasFilter = search || filterManufacturer || filterGroup || filterNoStock;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Slow-Mover / Dead-Stock</Typography>
          <Typography variant="body2" color="text.secondary">
            Artikel ohne Lagerbewegung seit mehr als <strong>{threshold} Tagen</strong>
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          {isManager && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setSettingsOpen(true)} size="small">
              Schwellwert ({threshold} Tage)
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} size="small">
            Aktualisieren
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder="Suche: Artikelnr., Bezeichnung, Hersteller, Gruppe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><FilterIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 280, flex: 2 }}
          />
          <TextField select size="small" label="Hersteller" value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Alle</MenuItem>
            {manufacturers.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Produktgruppe" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Alle</MenuItem>
            {productGroups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          <Button size="small" variant={filterNoStock ? "contained" : "outlined"} onClick={() => setFilterNoStock((v) => !v)} color={filterNoStock ? "warning" : "inherit"}>
            Bestand = 0
          </Button>
          {hasFilter && (
            <Button size="small" startIcon={<ClearIcon />} onClick={() => { setSearch(""); setFilterManufacturer(""); setFilterGroup(""); setFilterNoStock(false); }}>
              Zurücksetzen
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : filteredRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {hasFilter ? "Keine Treffer für die aktuellen Filter." : `Keine Slow-Mover – alle Artikel wurden in den letzten ${threshold} Tagen bewegt.`}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Artikelnummer</TableCell>
                <TableCell>Bezeichnung</TableCell>
                <TableCell>Hersteller</TableCell>
                <TableCell>Produktgruppe</TableCell>
                <TableCell align="right">Gesamtmenge</TableCell>
                <TableCell>Letzte Bewegung</TableCell>
                <TableCell align="right">Tage inaktiv</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.itemId} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{row.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.description}</Typography>
                    {row.descriptionSecondary && <Typography variant="caption" color="text.secondary">{row.descriptionSecondary}</Typography>}
                  </TableCell>
                  <TableCell>{row.manufacturer || "-"}</TableCell>
                  <TableCell>{row.productGroup || "-"}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: row.totalQuantity === 0 ? 700 : 400, color: row.totalQuantity === 0 ? "warning.main" : "text.primary" }}>
                      {row.totalQuantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={row.lastMovementAt ? "text.primary" : "error.main"}>
                      {formatDate(row.lastMovementAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={row.daysSinceLastMovement === null ? "Noch nie bewegt" : `${row.daysSinceLastMovement} Tage`}>
                      <Chip label={row.daysSinceLastMovement !== null ? `${row.daysSinceLastMovement} d` : "–"} color={getDaysSeverity(row.daysSinceLastMovement)} size="small" />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {filteredRows.length} von {rows.length} Artikeln · Rot: ≥ 365 Tage · Orange: ≥ 180 Tage · Blau: ≥ {threshold} Tage
        </Typography>
      )}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Slow-Mover Schwellwert</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Artikel ohne Bewegung seit mehr als diesem Wert gelten als Slow-Mover. Die Einstellung gilt für deine Niederlassung.
          </Typography>
          <TextField
            fullWidth label="Schwellwert in Tagen" type="number" value={editDays}
            onChange={(e) => setEditDays(Math.max(1, Math.min(3650, Number.parseInt(e.target.value, 10) || 1)))}
            inputProps={{ min: 1, max: 3650 }}
            InputProps={{ endAdornment: <InputAdornment position="end">Tage</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={handleSaveSettings} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── Verbrauchstrend Tab ───────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez",
};

const ConsumptionTrendTab: React.FC<{ warehouseId?: string }> = ({ warehouseId }) => {
  const theme = useTheme();
  const { items, loadItems } = useItemsStore();

  const [months, setMonths] = useState<6 | 12>(12);
  const [selectedItem, setSelectedItem] = useState<{ id: string; label: string } | null>(null);
  const [data, setData] = useState<ConsumptionTrendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) loadItems().catch(() => null);
  }, [items.length, loadItems]);

  const itemOptions = useMemo(
    () => items.map((i) => ({ id: i.id, label: `${i.code} – ${i.description}` })),
    [items],
  );

  const load = useCallback(async (m: 6 | 12, itemId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchConsumptionTrend(m, itemId, warehouseId);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void load(months, selectedItem?.id); }, [load, months, selectedItem]);

  const maxVal = Math.max(...data.map((d) => Math.max(d.checkouts, d.checkins)), 1);
  const formatMonth = (key: string) => {
    const [year, month] = key.split("-");
    return `${MONTH_LABELS[month] ?? month} ${year}`;
  };

  const totalCheckouts = data.reduce((s, d) => s + d.checkouts, 0);
  const totalCheckins = data.reduce((s, d) => s + d.checkins, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Verbrauchstrend</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedItem ? `Artikel: ${selectedItem.label}` : "Alle Artikel – monatliche Lagerbewegungen"}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup value={months} exclusive size="small" onChange={(_, v) => { if (v) setMonths(v as 6 | 12); }}>
            <ToggleButton value={6}>6 Monate</ToggleButton>
            <ToggleButton value={12}>12 Monate</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => load(months, selectedItem?.id)} size="small">
            Aktualisieren
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems="center">
          <Autocomplete
            options={itemOptions} value={selectedItem} onChange={(_, val) => setSelectedItem(val)}
            getOptionLabel={(opt) => opt.label} isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Artikel filtern (optional)" placeholder="Artikelnr. oder Bezeichnung…"
                InputProps={{ ...params.InputProps, startAdornment: <><FilterIcon fontSize="small" sx={{ ml: 0.5, mr: 0.5, color: "text.secondary" }} />{params.InputProps.startAdornment}</> }}
              />
            )}
            sx={{ flex: 1, minWidth: 280 }} clearOnEscape
          />
          {selectedItem && (
            <Button size="small" startIcon={<ClearIcon />} onClick={() => setSelectedItem(null)}>Alle Artikel</Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
            <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">Entnahmen gesamt</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.error.main }}>{totalCheckouts}</Typography>
              <Typography variant="caption" color="text.secondary">letzten {months} Monate</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">Eingänge gesamt</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main }}>{totalCheckins}</Typography>
              <Typography variant="caption" color="text.secondary">letzten {months} Monate</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">Ø Entnahmen / Monat</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {data.length > 0 ? Math.round(totalCheckouts / data.length) : 0}
              </Typography>
            </Paper>
            {selectedItem && (
              <Paper variant="outlined" sx={{ p: 2, minWidth: 160, borderColor: "primary.main" }}>
                <Typography variant="caption" color="text.secondary">Netto-Verbrauch</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: totalCheckouts - totalCheckins >= 0 ? "error.main" : "success.main" }}>
                  {totalCheckouts - totalCheckins >= 0 ? "-" : "+"}{Math.abs(totalCheckouts - totalCheckins)}
                </Typography>
                <Typography variant="caption" color="text.secondary">Entnahmen minus Eingänge</Typography>
              </Paper>
            )}
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: 220, overflowX: "auto", pb: 1 }}>
              {data.map((entry) => {
                const checkoutHeight = Math.round((entry.checkouts / maxVal) * 180);
                const checkinHeight = Math.round((entry.checkins / maxVal) * 180);
                return (
                  <Box key={entry.month} sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 190 }}>
                      <Tooltip title={`Entnahmen: ${entry.checkouts}`}>
                        <Box sx={{ width: 18, height: checkoutHeight || 2, bgcolor: theme.palette.error.main, borderRadius: "3px 3px 0 0", opacity: 0.85, cursor: "default", transition: "height 0.3s" }} />
                      </Tooltip>
                      <Tooltip title={`Eingänge: ${entry.checkins}`}>
                        <Box sx={{ width: 18, height: checkinHeight || 2, bgcolor: theme.palette.success.main, borderRadius: "3px 3px 0 0", opacity: 0.85, cursor: "default", transition: "height 0.3s" }} />
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" sx={{ mt: 0.5, fontSize: 10, textAlign: "center", whiteSpace: "nowrap" }}>
                      {formatMonth(entry.month)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: 1, justifyContent: "center" }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 14, height: 14, bgcolor: "error.main", borderRadius: 0.5 }} />
                <Typography variant="caption">Entnahmen</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 14, height: 14, bgcolor: "success.main", borderRadius: 0.5 }} />
                <Typography variant="caption">Eingänge</Typography>
              </Stack>
            </Stack>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Monat</TableCell>
                  <TableCell align="right">Entnahmen</TableCell>
                  <TableCell align="right">Eingänge</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...data].reverse().map((entry) => {
                  const saldo = entry.checkins - entry.checkouts;
                  return (
                    <TableRow key={entry.month} hover>
                      <TableCell>{formatMonth(entry.month)}</TableCell>
                      <TableCell align="right" sx={{ color: "error.main", fontWeight: 600 }}>{entry.checkouts}</TableCell>
                      <TableCell align="right" sx={{ color: "success.main", fontWeight: 600 }}>{entry.checkins}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: saldo >= 0 ? "success.main" : "error.main" }}>
                          {saldo >= 0 ? "+" : ""}{saldo}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

// ── Artikel-Auswertung Tab ────────────────────────────────────────────────────

type SortField = "checkoutCount" | "checkinCount" | "checkoutQty" | "checkinQty" | "lastMovementAt" | "code";
type SortDir = "asc" | "desc";

const ArticleActivityTab: React.FC<{ warehouseId?: string }> = ({ warehouseId }) => {
  const theme = useTheme();

  const defaultRange = getPresetRange(30);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [activePreset, setActivePreset] = useState<number>(30);

  const [rows, setRows] = useState<ArticleActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [sortField, setSortField] = useState<SortField>("checkoutCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchArticleActivity(f, t, warehouseId);
      setRows(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void load(from, to); }, [load]);

  const handlePreset = (days: number) => {
    const range = getPresetRange(days);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(days);
    void load(range.from, range.to);
  };

  const handleCustomLoad = () => {
    setActivePreset(0);
    void load(from, to);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const manufacturers = useMemo(() => {
    const set = new Set(rows.map((r) => r.manufacturer).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const productGroups = useMemo(() => {
    const set = new Set(rows.map((r) => r.productGroup).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    let filtered = rows.filter((row) => {
      if (filterManufacturer && row.manufacturer !== filterManufacturer) return false;
      if (filterGroup && row.productGroup !== filterGroup) return false;
      if (q) {
        return (
          row.code.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          (row.descriptionSecondary ?? "").toLowerCase().includes(q) ||
          (row.manufacturer ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      let av: number | string = a[sortField] ?? 0;
      let bv: number | string = b[sortField] ?? 0;
      if (sortField === "lastMovementAt") {
        av = a.lastMovementAt ? new Date(a.lastMovementAt).getTime() : 0;
        bv = b.lastMovementAt ? new Date(b.lastMovementAt).getTime() : 0;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv, "de") : bv.localeCompare(av, "de");
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return filtered;
  }, [rows, search, filterManufacturer, filterGroup, sortField, sortDir]);

  const totals = useMemo(() => ({
    checkoutCount: filteredRows.reduce((s, r) => s + r.checkoutCount, 0),
    checkinCount: filteredRows.reduce((s, r) => s + r.checkinCount, 0),
    checkoutQty: filteredRows.reduce((s, r) => s + r.checkoutQty, 0),
    checkinQty: filteredRows.reduce((s, r) => s + r.checkinQty, 0),
  }), [filteredRows]);

  const hasFilter = search || filterManufacturer || filterGroup;

  const SortCell = ({ field, label, align = "right" }: { field: SortField; label: string; align?: "left" | "right" }) => (
    <TableCell align={align}>
      <TableSortLabel active={sortField === field} direction={sortField === field ? sortDir : "desc"} onClick={() => handleSort(field)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Artikel-Auswertung</Typography>
          <Typography variant="body2" color="text.secondary">
            Ein- und Ausgänge pro Artikel im gewählten Zeitraum
          </Typography>
        </Box>
        {rows.length > 0 && (
          <Button variant="outlined" startIcon={<FileDownloadIcon />} size="small" onClick={() => exportCsv(filteredRows, from, to)}>
            CSV Export
          </Button>
        )}
      </Stack>

      {/* Zeitraum-Auswahl */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems="center" flexWrap="wrap">
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {presets.map((p) => (
              <Button
                key={p.days} size="small"
                variant={activePreset === p.days ? "contained" : "outlined"}
                onClick={() => handlePreset(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
          <Stack direction="row" gap={1} alignItems="center">
            <TextField size="small" type="date" label="Von" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
            <TextField size="small" type="date" label="Bis" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
            <Button variant="contained" size="small" startIcon={<RefreshIcon />} onClick={handleCustomLoad}>
              Laden
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Filter */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} flexWrap="wrap" alignItems="center">
          <TextField
            size="small" placeholder="Suche: Artikelnr., Bezeichnung, Hersteller…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><FilterIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 280, flex: 2 }}
          />
          <TextField select size="small" label="Hersteller" value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Alle</MenuItem>
            {manufacturers.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Produktgruppe" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Alle</MenuItem>
            {productGroups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          {hasFilter && (
            <Button size="small" startIcon={<ClearIcon />} onClick={() => { setSearch(""); setFilterManufacturer(""); setFilterGroup(""); }}>
              Zurücksetzen
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI-Karten */}
      {!loading && rows.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">Entnahmen</Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <ArrowDownIcon fontSize="small" sx={{ color: "error.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "error.main" }}>{totals.checkoutCount}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">{totals.checkoutQty} Stk. gesamt</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">Eingänge</Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <ArrowUpIcon fontSize="small" sx={{ color: "success.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "success.main" }}>{totals.checkinCount}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">{totals.checkinQty} Stk. gesamt</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">Artikel bewegt</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{filteredRows.length}</Typography>
            <Typography variant="caption" color="text.secondary">
              {from} – {to}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">Netto-Saldo</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: totals.checkinQty - totals.checkoutQty >= 0 ? "success.main" : "error.main" }}>
              {totals.checkinQty - totals.checkoutQty >= 0 ? "+" : ""}{totals.checkinQty - totals.checkoutQty}
            </Typography>
            <Typography variant="caption" color="text.secondary">Eingänge minus Entnahmen</Typography>
          </Paper>
        </Stack>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : filteredRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {rows.length === 0
              ? "Keine Bewegungen im gewählten Zeitraum."
              : "Keine Treffer für die aktuellen Filter."}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <SortCell field="code" label="Artikelnummer" align="left" />
                <TableCell>Bezeichnung</TableCell>
                <TableCell>Hersteller</TableCell>
                <TableCell>Produktgruppe</TableCell>
                <SortCell field="checkoutCount" label="Entnahmen (Anz.)" />
                <SortCell field="checkoutQty" label="Entnahmen (Menge)" />
                <SortCell field="checkinCount" label="Eingänge (Anz.)" />
                <SortCell field="checkinQty" label="Eingänge (Menge)" />
                <SortCell field="lastMovementAt" label="Letzte Bewegung" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.itemId} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{row.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.description}</Typography>
                    {row.descriptionSecondary && <Typography variant="caption" color="text.secondary">{row.descriptionSecondary}</Typography>}
                  </TableCell>
                  <TableCell>{row.manufacturer || "-"}</TableCell>
                  <TableCell>{row.productGroup || "-"}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={row.checkoutCount}
                      size="small"
                      icon={<ArrowDownIcon />}
                      color={row.checkoutCount > 0 ? "error" : "default"}
                      variant={row.checkoutCount > 0 ? "filled" : "outlined"}
                      sx={{ minWidth: 52 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: row.checkoutQty > 0 ? theme.palette.error.main : "text.secondary", fontWeight: 600 }}>
                    {row.checkoutQty > 0 ? `-${row.checkoutQty}` : "0"}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={row.checkinCount}
                      size="small"
                      icon={<ArrowUpIcon />}
                      color={row.checkinCount > 0 ? "success" : "default"}
                      variant={row.checkinCount > 0 ? "filled" : "outlined"}
                      sx={{ minWidth: 52 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: row.checkinQty > 0 ? theme.palette.success.main : "text.secondary", fontWeight: 600 }}>
                    {row.checkinQty > 0 ? `+${row.checkinQty}` : "0"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(row.lastMovementAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && filteredRows.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {filteredRows.length} Artikel · Klick auf Spaltenköpfe zum Sortieren
        </Typography>
      )}
    </Box>
  );
};

// ── Hauptseite ────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Artikel-Auswertung", icon: <BarChartIcon /> },
  { label: "Verbrauchstrend", icon: <ShowChartIcon /> },
  { label: "Slow-Mover / Dead-Stock", icon: <TrendingDownIcon /> },
];

const ReportsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [tab, setTab] = useState(0);
  const [warehouses, setWarehouses] = useState<LocationDto[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  useEffect(() => {
    fetchWarehouses().then(setWarehouses).catch(() => null);
  }, []);

  return (
    <Box sx={embedded ? {} : { p: { xs: 1, sm: 2 } }}>
      {!embedded && (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Berichte & Analysen</Typography>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {warehouses.length > 1 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <FilterIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <TextField
              select
              size="small"
              label="Lager"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Alle Lager</MenuItem>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name ? `${w.code} – ${w.name}` : w.code}
                </MenuItem>
              ))}
            </TextField>
            {warehouseId && (
              <Button size="small" startIcon={<ClearIcon />} onClick={() => setWarehouseId("")}>
                Zurücksetzen
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t, i) => (
          <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
        ))}
      </Tabs>

      {tab === 0 && <ArticleActivityTab warehouseId={warehouseId || undefined} />}
      {tab === 1 && <ConsumptionTrendTab warehouseId={warehouseId || undefined} />}
      {tab === 2 && <SlowMoverTab warehouseId={warehouseId || undefined} />}
    </Box>
  );
};

export default ReportsPage;
