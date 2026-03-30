import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
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
  CircularProgress,
  Alert,
  Autocomplete,
} from "@mui/material";
import dayjs from "dayjs";
import useItemsStore from "../store/useItemsStore";
import useUsersStore from "../store/useUsersStore";
import { fetchMovementHistory, cleanupMovements, MovementDto } from "../utils/api";

const MovementHistoryPage: React.FC = () => {
  const { items, loadItems } = useItemsStore();
  const { users, loadUsers } = useUsersStore();
  const [filters, setFilters] = useState({
    itemId: "",
    vehicleId: "",
    userId: "",
    type: "",
    from: "",
    to: "",
  });
  const [data, setData] = useState<MovementDto[]>([]);
  const [summary, setSummary] = useState<{ totalCheckinQty: number; totalCheckoutQty: number; totalCheckinCount: number; totalCheckoutCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupDate, setCleanupDate] = useState("");
  const [cleanupType, setCleanupType] = useState<string>("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      loadItems().catch(() => null);
    }
    if (users.length === 0) {
      loadUsers().catch(() => null);
    }
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const fromDate = filters.from ? dayjs(filters.from, "YYYY-MM-DD").startOf("day") : null;
    const toDate = filters.to ? dayjs(filters.to, "YYYY-MM-DD").endOf("day") : null;
    try {
      const res = await fetchMovementHistory({
        itemId: filters.itemId || undefined,
        vehicleId: filters.vehicleId || undefined,
        userId: filters.userId || undefined,
        type: filters.type ? (filters.type as "CHECKIN" | "CHECKOUT") : undefined,
        from: fromDate?.isValid() ? fromDate.toDate().toISOString() : undefined,
        to: toDate?.isValid() ? toDate.toDate().toISOString() : undefined,
        limit: 500,
      });
      // Clientseitiger Filter zur Sicherheit (falls Backend-Zeitzonen/Parsing abweicht)
      const filteredMovements = res.movements.filter((m) => {
        const ts = dayjs(m.occurredAt);
        if (fromDate && fromDate.isValid() && ts.isBefore(fromDate)) return false;
        if (toDate && toDate.isValid() && ts.isAfter(toDate)) return false;
        return true;
      });

      const computedSummary = filteredMovements.reduce(
        (acc, m) => {
          if (m.type === "CHECKIN") {
            acc.totalCheckinQty += m.quantity;
            acc.totalCheckinCount += 1;
          } else if (m.type === "CHECKOUT") {
            acc.totalCheckoutQty += m.quantity;
            acc.totalCheckoutCount += 1;
          }
          return acc;
        },
        { totalCheckinQty: 0, totalCheckoutQty: 0, totalCheckinCount: 0, totalCheckoutCount: 0 }
      );

      setData(filteredMovements);
      setSummary(computedSummary);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Bewegungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Bewegungen (Historie)
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} direction={{ xs: "column", sm: "row" }} flexWrap="wrap" useFlexGap>
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
          <Button variant="contained" onClick={loadData} disabled={loading}>
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
                  before: dayjs(cleanupDate, "YYYY-MM-DD").endOf("day").toISOString(),
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
                    <TableCell>{dayjs(m.occurredAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                    <TableCell>{m.type === "CHECKIN" ? "Einbuchung" : "Ausbuchung"}</TableCell>
                    <TableCell align="right">{m.quantity}</TableCell>
                    <TableCell>{m.item?.code} - {m.item?.description}</TableCell>
                    <TableCell>{m.vehicle?.licensePlate || m.vehicle?.description || "-"}</TableCell>
                    <TableCell>{m.user?.displayName || "-"}</TableCell>
                    <TableCell>{m.source || "-"}</TableCell>
                    <TableCell>{m.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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

export default MovementHistoryPage;
