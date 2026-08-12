import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  Autocomplete,
  FormControlLabel,
  Switch,
  Tooltip,
  IconButton,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import useItemsStore from "../store/useItemsStore";
import useUsersStore from "../store/useUsersStore";
import useAuthStore from "../store/useAuthStore";
import { fetchMovementHistory, fetchWarehouses, cleanupMovements, fetchDeliveryNoteExists, openDeliveryNotePdf, MovementDto, type LocationDto } from "../utils/api";
import ReportsPage from "./ReportsPage";

// Extrahiert die Auftragsnummer aus einem QR-Code (LFS/460234/101501/400 → "101501")
// oder gibt den Wert unverändert zurück falls er kein LFS-Format hat.
const extractAuftragsnummer = (source: string | null | undefined): string | null => {
  if (!source) return null;
  const parts = source.split("/");
  if (parts.length >= 3 && parts[0] === "LFS") return parts[2];
  return source;
};

const MovementHistoryTab: React.FC = () => {
  const { items, loadItems } = useItemsStore();
  const { users, loadUsers } = useUsersStore();
  const { user: authUser } = useAuthStore();
  const hasLocationScope = (authUser?.locationIds?.length ?? 0) > 0;
  const [filters, setFilters] = useState({
    itemId: "",
    vehicleId: "",
    userId: "",
    type: "",
    from: "",
    to: "",
  });
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<LocationDto[]>([]);
  const [includeVehicles, setIncludeVehicles] = useState(!hasLocationScope);
  const [data, setData] = useState<MovementDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sourceSearch, setSourceSearch] = useState("");
  const [summary, setSummary] = useState<{ totalCheckinQty: number; totalCheckoutQty: number; totalCheckinCount: number; totalCheckoutCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupDate, setCleanupDate] = useState("");
  const [cleanupType, setCleanupType] = useState<string>("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [deliveryNoteVnrs, setDeliveryNoteVnrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (items.length === 0) {
      loadItems().catch(() => null);
    }
    if (users.length === 0) {
      loadUsers().catch(() => null);
    }
    fetchWarehouses().then(setWarehouses).catch(() => null);
  }, [items.length, loadItems, users.length, loadUsers]);

  const itemOptions = useMemo(
    () => items.map((i) => ({ id: i.id, label: `${i.code} - ${i.description}` })),
    [items]
  );

  const vehicleOptions = useMemo(() => {
    const vehicles: Record<string, { id: string; label: string }> = {};
    data.forEach((m) => {
      if (m.vehicle?.id) {
        vehicles[m.vehicle.id] = { id: m.vehicle.id, label: `${m.vehicle.licensePlate || ""} ${m.vehicle.description || ""}`.trim() || m.vehicle.id };
      }
    });
    return Object.values(vehicles);
  }, [data]);

  const userOptions = useMemo(() => {
    const opts = users.map((u) => ({ id: u.id, label: u.displayName || u.username }));
    if (data.length > 0) {
      data.forEach((m) => {
        if (m.user?.id && !opts.find((o) => o.id === m.user!.id)) {
          opts.push({ id: m.user.id, label: m.user.displayName || m.user.id });
        }
      });
    }
    return opts;
  }, [users, data]);

  const loadData = async (currentPage = page, rpp = rowsPerPage) => {
    setLoading(true);
    setError(null);
    const fromDate = filters.from ? startOfDay(parseISO(filters.from)) : null;
    const toDate = filters.to ? endOfDay(parseISO(filters.to)) : null;
    try {
      const res = await fetchMovementHistory({
        itemId: filters.itemId || undefined,
        vehicleId: filters.vehicleId || undefined,
        userId: filters.userId || undefined,
        type: filters.type ? (filters.type as "CHECKIN" | "CHECKOUT") : undefined,
        from: fromDate ? fromDate.toISOString() : undefined,
        to: toDate ? toDate.toISOString() : undefined,
        limit: rpp,
        offset: currentPage * rpp,
        warehouseId: warehouseId || undefined,
        source: sourceSearch.trim() || undefined,
        includeVehicles: includeVehicles || undefined,
      });
      setData(res.movements);
      setTotal(res.total);
      setSummary(res.summary);

      const vnrs = res.movements.map((m) => extractAuftragsnummer(m.source)).filter(Boolean) as string[];
      fetchDeliveryNoteExists(vnrs).then(setDeliveryNoteVnrs).catch(() => null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Bewegungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(0);
    void loadData(0, rowsPerPage);
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Bewegungen (Historie)
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} direction={{ xs: "column", sm: "row" }} flexWrap="wrap" useFlexGap>
          {warehouses.length > 1 && (
            <TextField
              select
              size="small"
              label="Lager"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Alle Lager</MenuItem>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name ? `${w.code} – ${w.name}` : w.code}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Autocomplete
            options={itemOptions}
            getOptionLabel={(opt) => opt.label}
            value={itemOptions.find((opt) => opt.id === filters.itemId) || null}
            onChange={(_, val) => setFilters((f) => ({ ...f, itemId: val?.id || "" }))}
            renderInput={(params) => (
              <TextField {...params} label="Artikel (Suche)" size="small" placeholder="Code oder Bezeichnung" sx={{ minWidth: 260 }} />
            )}
            clearOnEscape
          />
          <TextField
            select
            size="small"
            label="Fahrzeug"
            value={filters.vehicleId}
            onChange={(e) => setFilters((f) => ({ ...f, vehicleId: e.target.value }))}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Alle</MenuItem>
            {vehicleOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Benutzer"
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Alle</MenuItem>
            {userOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Typ"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value="CHECKIN">Einbuchung</MenuItem>
            <MenuItem value="CHECKOUT">Ausbuchung</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Von"
            InputLabelProps={{ shrink: true }}
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            type="date"
            label="Bis"
            InputLabelProps={{ shrink: true }}
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            label="Vorgangsnummer / Quelle"
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            sx={{ minWidth: 200 }}
            placeholder="z.B. A-1234"
          />
          {hasLocationScope && (
            <FormControlLabel
              control={
                <Switch
                  checked={includeVehicles}
                  onChange={(e) => setIncludeVehicles(e.target.checked)}
                  size="small"
                />
              }
              label="Fahrzeugbuchungen einschließen"
            />
          )}
          <Button variant="contained" onClick={handleFilter} disabled={loading}>
            {loading ? "Lade..." : "Filtern"}
          </Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1} direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="body2" color="text.secondary">Bereinigung (Manager)</Typography>
          <TextField
            type="date"
            size="small"
            label="Lösche Bewegungen vor"
            InputLabelProps={{ shrink: true }}
            value={cleanupDate}
            onChange={(e) => setCleanupDate(e.target.value)}
            sx={{ minWidth: 190 }}
          />
          <TextField
            select
            size="small"
            label="Typ (optional)"
            value={cleanupType}
            onChange={(e) => setCleanupType(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Alle</MenuItem>
            <MenuItem value="CHECKIN">Einbuchung</MenuItem>
            <MenuItem value="CHECKOUT">Ausbuchung</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            color="error"
            disabled={!cleanupDate || cleanupLoading}
            onClick={async () => {
              if (!cleanupDate) return;
              const confirmText = `Bewegungen vor ${cleanupDate}${cleanupType ? " vom Typ " + cleanupType : ""} löschen? Dies kann nicht rückgängig gemacht werden.`;
              if (!window.confirm(confirmText)) return;
              setCleanupLoading(true);
              try {
                const res = await cleanupMovements({
                  before: endOfDay(parseISO(cleanupDate)).toISOString(),
                  type: cleanupType ? (cleanupType as "CHECKIN" | "CHECKOUT") : undefined,
                });
                setSnackbar(`Bereinigt: ${res.deleted} Bewegungen gelöscht.`);
                await loadData();
              } catch (err: any) {
                setError(err?.response?.data?.message || "Bereinigung fehlgeschlagen");
              } finally {
                setCleanupLoading(false);
              }
            }}
          >
            {cleanupLoading ? "Lösche..." : "Bereinigen"}
          </Button>
        </Stack>
        {summary && (
          <Box sx={{ mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
            <ChipPair label="Einbuchungen" value={`${summary.totalCheckinQty} Stk (${summary.totalCheckinCount} Buchungen)`} color="success" />
            <ChipPair label="Ausbuchungen" value={`${summary.totalCheckoutQty} Stk (${summary.totalCheckoutCount} Buchungen)`} color="error" />
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : data.length === 0 ? (
          <Alert severity="info">Keine Bewegungen gefunden.</Alert>
        ) : (
          <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Datum</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell align="right">Menge</TableCell>
                  <TableCell>Artikel</TableCell>
                  <TableCell>Fahrzeug</TableCell>
                  <TableCell>Benutzer</TableCell>
                  <TableCell>Quelle</TableCell>
                  <TableCell>Notiz</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{format(new Date(m.occurredAt), "dd.MM.yyyy HH:mm")}</TableCell>
                    <TableCell sx={{ color: m.type === "CHECKIN" ? "success.main" : "error.main", fontWeight: 600 }}>
                      {m.type === "CHECKIN" ? "Einbuchung" : "Ausbuchung"}
                    </TableCell>
                    <TableCell align="right" sx={{ color: m.type === "CHECKIN" ? "success.main" : "error.main", fontWeight: 700 }}>
                      {m.type === "CHECKIN" ? "+" : "−"}{m.quantity}
                    </TableCell>
                    <TableCell>{m.item?.code} - {m.item?.description}</TableCell>
                    <TableCell>{m.vehicle?.licensePlate || m.vehicle?.description || "-"}</TableCell>
                    <TableCell>{m.user?.displayName || "-"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {m.source || "-"}
                        {m.source && deliveryNoteVnrs.has(extractAuftragsnummer(m.source)!) && (
                          <Tooltip title="Lieferschein öffnen">
                            <IconButton
                              size="small"
                              onClick={() =>
                                openDeliveryNotePdf(extractAuftragsnummer(m.source)!).catch(() =>
                                  setError(`Lieferschein ${extractAuftragsnummer(m.source)} nicht gefunden – PDF möglicherweise nicht mehr auf dem Server.`)
                                )
                              }
                              sx={{ color: "error.main", p: 0.25 }}
                            >
                              <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{m.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => {
              setPage(newPage);
              void loadData(newPage, rowsPerPage);
            }}
            onRowsPerPageChange={(e) => {
              const rpp = parseInt(e.target.value, 10);
              setRowsPerPage(rpp);
              setPage(0);
              void loadData(0, rpp);
            }}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="Zeilen:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} von ${count}`}
          />
          </>
        )}
      </Paper>

      {snackbar && (
        <Paper sx={{ p: 1.5, mt: 2, bgcolor: "success.50" }}>
          <Typography variant="body2" color="success.main">{snackbar}</Typography>
          <Button size="small" onClick={() => setSnackbar(null)}>OK</Button>
        </Paper>
      )}
    </Box>
  );
};

const ChipPair = ({ label, value, color }: { label: string; value: string; color?: "success" | "error" | "info" | "warning" }) => (
  <Box sx={{ display: "flex", gap: 1, alignItems: "center", px: 1.5, py: 0.75, borderRadius: 1, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" color={color ? `${color}.main` : "text.primary"} sx={{ fontWeight: 600 }}>{value}</Typography>
  </Box>
);

const MovementHistoryPage: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Bewegungshistorie" />
        <Tab label="Berichte & Analysen" />
      </Tabs>

      {tab === 0 && <MovementHistoryTab />}
      {tab === 1 && <ReportsPage embedded />}
    </Box>
  );
};

export default MovementHistoryPage;
