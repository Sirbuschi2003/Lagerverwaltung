import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit } from "@mui/icons-material";
import { fetchBranches, createBranch, updateBranch, deleteBranch, type BranchDto } from "../utils/api";

const emptyForm = { name: "", externalCode: "", address: "", active: true };

const BranchesPage: React.FC = () => {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBranches();
      setBranches(data);
    } catch {
      setError("Niederlassungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (branch: BranchDto) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      externalCode: branch.externalCode ?? "",
      address: branch.address ?? "",
      active: branch.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        externalCode: form.externalCode.trim() || null,
        address: form.address.trim() || null,
        active: form.active,
      };
      if (editingId) {
        await updateBranch(editingId, payload);
      } else {
        await createBranch(payload);
      }
      setDialogOpen(false);
      await load();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Niederlassung "${name}" wirklich löschen?`)) return;
    try {
      await deleteBranch(id);
      await load();
    } catch {
      setError("Löschen fehlgeschlagen. Die Niederlassung wird möglicherweise noch verwendet.");
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Niederlassungen
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Neue Niederlassung
        </Button>
      </Stack>

      {error && (
        <Typography color="error" mb={2}>{error}</Typography>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Nr.</strong></TableCell>
                <TableCell><strong>Adresse</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Aktionen</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Keine Niederlassungen vorhanden
                  </TableCell>
                </TableRow>
              )}
              {branches.map((branch) => (
                <TableRow key={branch.id} hover>
                  <TableCell>{branch.name}</TableCell>
                  <TableCell>
                    {branch.externalCode ? (
                      <Chip label={branch.externalCode} size="small" variant="outlined" />
                    ) : (
                      <Typography color="text.secondary" variant="body2">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {branch.address ? (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{branch.address}</Typography>
                    ) : (
                      <Typography color="text.secondary" variant="body2">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={branch.active ? "Aktiv" : "Inaktiv"}
                      color={branch.active ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Bearbeiten">
                      <IconButton size="small" onClick={() => openEdit(branch)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Löschen">
                      <IconButton size="small" color="error" onClick={() => handleDelete(branch.id, branch.name)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Erstellen / Bearbeiten Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Niederlassung bearbeiten" : "Neue Niederlassung"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label="Niederlassungsnummer (z.B. 400)"
              value={form.externalCode}
              onChange={(e) => setForm((f) => ({ ...f, externalCode: e.target.value }))}
              fullWidth
              helperText="Optionale externe Kennung für Systemintegration"
            />
            <TextField
              label="Adresse"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <Typography variant="body2">Niederlassung aktiv</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? <CircularProgress size={18} /> : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BranchesPage;
