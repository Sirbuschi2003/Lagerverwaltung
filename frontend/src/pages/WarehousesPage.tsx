import React, { useEffect, useState } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import useAuthStore from "../store/useAuthStore";
import {
  fetchBranches,
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type BranchDto,
  type WarehouseDto,
  type CreateWarehouseRequest,
} from "../utils/api";

const emptyForm: CreateWarehouseRequest = {
  name: "",
  code: "",
  description: "",
  branchId: undefined,
  active: true,
};

const WarehousesPage = () => {
  const user = useAuthStore((s: any) => s.user);
  const isSuperAdmin = user?.role === "MANAGER" && user?.branchId === null;
  const isManager = user?.role === "MANAGER";

  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WarehouseDto | null>(null);
  const [form, setForm] = useState<CreateWarehouseRequest>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseDto | null>(null);

  const [filterBranchId, setFilterBranchId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterBranchId ? { branchId: filterBranchId } : undefined;
      setWarehouses(await fetchWarehouses(params));
    } catch {
      setError("Lager konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (isSuperAdmin) {
      fetchBranches().then(setBranches).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId]);

  const branchName = (id: string | undefined | null) =>
    branches.find((b) => b.id === id)?.name ?? id ?? "–";

  const handleOpenCreate = () => {
    setForm({ ...emptyForm, branchId: isSuperAdmin ? undefined : user?.branchId ?? undefined });
    setEditTarget(null);
    setOpen(true);
  };

  const handleOpenEdit = (w: WarehouseDto) => {
    setEditTarget(w);
    setForm({
      name: w.name,
      code: w.code ?? "",
      description: w.description ?? "",
      branchId: w.branchId ?? undefined,
      active: w.active,
    });
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    setEditTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateWarehouseRequest = {
        ...form,
        name: form.name.trim(),
        code: form.code?.trim() || null,
        description: form.description?.trim() || null,
      };
      if (editTarget) {
        await updateWarehouse(editTarget.id, payload);
      } else {
        await createWarehouse(payload);
      }
      setOpen(false);
      await load();
    } catch {
      setError("Lager konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWarehouse(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch {
      setError("Lager konnte nicht gelöscht werden. Möglicherweise noch Benutzer oder Artikel zugeordnet.");
      setDeleteTarget(null);
    }
  };

  if (!isManager) {
    return <Alert severity="info">Diese Seite steht nur der Leitung zur Verfügung.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Lagerverwaltung
      </Typography>

      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Verwalte Lager (z. B. Teilelager, Tonerlager) innerhalb der Niederlassungen.
              Benutzer werden einem Lager zugewiesen und sehen nur dessen Artikel, Bestände und Bestellungen.
            </Typography>
          </Grid>
          {isSuperAdmin && (
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Niederlassung filtern</InputLabel>
                <Select
                  value={filterBranchId}
                  label="Niederlassung filtern"
                  onChange={(e: SelectChangeEvent<string>) => setFilterBranchId(e.target.value)}
                >
                  <MenuItem value=""><em>Alle</em></MenuItem>
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
              Lager anlegen
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ backgroundColor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Kürzel</TableCell>
              {isSuperAdmin && <TableCell>Niederlassung</TableCell>}
              <TableCell>Beschreibung</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouses.map((w) => (
              <TableRow key={w.id} hover>
                <TableCell>{w.name}</TableCell>
                <TableCell>{w.code ?? "–"}</TableCell>
                {isSuperAdmin && <TableCell>{branchName(w.branchId)}</TableCell>}
                <TableCell>{w.description ?? "–"}</TableCell>
                <TableCell>
                  {w.active ? (
                    <Chip label="Aktiv" size="small" color="success" variant="outlined" />
                  ) : (
                    <Chip label="Inaktiv" size="small" color="default" variant="outlined" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton size="small" onClick={() => handleOpenEdit(w)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(w)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!loading && warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Lager angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Anlegen / Bearbeiten Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editTarget ? "Lager bearbeiten" : "Neues Lager"}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Name *"
                  fullWidth
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="z. B. Teilelager, Tonerlager"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Kürzel"
                  fullWidth
                  value={form.code ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="z. B. TEILE"
                  inputProps={{ maxLength: 20 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Beschreibung"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </Grid>
              {isSuperAdmin && (
                <Grid item xs={12}>
                  <FormControl fullWidth required={!editTarget}>
                    <InputLabel>Niederlassung *</InputLabel>
                    <Select
                      value={form.branchId ?? ""}
                      label="Niederlassung *"
                      onChange={(e: SelectChangeEvent<string>) =>
                        setForm((p) => ({ ...p, branchId: e.target.value || undefined }))
                      }
                    >
                      <MenuItem value=""><em>Bitte wählen</em></MenuItem>
                      {branches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.active ?? true}
                      onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                    />
                  }
                  label="Aktiv"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={submitting}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={submitting || !form.name.trim()}>
              {editTarget ? "Speichern" : "Anlegen"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Lager löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Soll das Lager <strong>„{deleteTarget?.name}"</strong> wirklich gelöscht werden?
            Alle zugewiesenen Benutzer und Artikel verlieren ihre Lager-Zuordnung.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Löschen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WarehousesPage;
