import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormControlLabel,
  Checkbox,
  MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useVehiclesStore from "../store/useVehiclesStore";
import useAuthStore from "../store/useAuthStore";
import type {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  CloneVehicleStockRequest,
} from "../utils/api";
import { cloneVehicleStock } from "../utils/api";

const initialForm: CreateVehicleRequest = {
  licensePlate: "",
  description: "",
};

const VehiclesPage = () => {
  const {
    vehicles,
    loadVehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    isLoading,
  } = useVehiclesStore();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateVehicleRequest>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const canCloneStock = hasPermission("stock.manage");
  const [cloneSource, setCloneSource] = useState<string>("");
  const [cloneTarget, setCloneTarget] = useState<string>("");
  const [copyQuantities, setCopyQuantities] = useState<boolean>(true);
  const [cloneMessage, setCloneMessage] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    void loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedVehicles = useMemo(
    () =>
      [...vehicles].sort((a, b) =>
        a.licensePlate.localeCompare(b.licensePlate, "de", {
          sensitivity: "base",
        }),
      ),
    [vehicles],
  );

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleOpenCreate = () => {
    setError(null);
    setForm(initialForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const vehicle = vehicles.find((entry: any) => entry.id === id);
    if (!vehicle) return;
    setForm({
      licensePlate: vehicle.licensePlate,
      description: vehicle.description,
    });
    setEditingId(id);
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setEditingId(null);
  };

  const validate = () => {
    if (!form.licensePlate.trim()) return "Bitte Kennzeichen eingeben.";
    if (!form.description.trim()) return "Bitte Beschreibung eingeben.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payloadBase = {
      licensePlate: form.licensePlate.trim().toUpperCase(),
      description: form.description.trim(),
    };

    try {
      if (editingId) {
        const updatePayload: UpdateVehicleRequest = { ...payloadBase };
        await updateVehicle(editingId, updatePayload);
      } else {
        const createPayload: CreateVehicleRequest = { ...payloadBase };
        await addVehicle(createPayload);
      }
      setOpen(false);
      setEditingId(null);
      setForm(initialForm);
    } catch (submissionError) {
      console.error(submissionError);
      setError("Fahrzeug konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVehicle(deleteTarget);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    if (!canCloneStock) return;
    if (!cloneSource && sortedVehicles.length > 0) {
      setCloneSource(sortedVehicles[0].id);
    }
    if (!cloneTarget && sortedVehicles.length > 1) {
      setCloneTarget(sortedVehicles[1].id);
    }
  }, [canCloneStock, sortedVehicles, cloneSource, cloneTarget]);

  const handleCloneStock = async () => {
    setCloneMessage(null);
    setCloneError(null);
    if (!cloneSource || !cloneTarget) {
      setCloneError("Bitte Quell- und Zielfahrzeug wählen.");
      return;
    }
    if (cloneSource === cloneTarget) {
      setCloneError("Quell- und Zielfahrzeug dürfen nicht identisch sein.");
      return;
    }
    const payload: CloneVehicleStockRequest = {
      sourceVehicleId: cloneSource,
      targetVehicleId: cloneTarget,
      copyQuantities,
    };
    setIsCloning(true);
    try {
      const result = await cloneVehicleStock(payload);
      setCloneMessage(`Bestand geklont: ${result.cloned} Positionen${result.copyQuantities ? " (mit Mengen)" : " (nur Sollwerte)"}.`);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.message;
      setCloneError(Array.isArray(message) ? message.join(", ") : message || "Klonen fehlgeschlagen.");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Fahrzeuge
      </Typography>
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Hinterlege Servicefahrzeuge, damit Bestände klar zugeordnet werden
              können.
            </Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={handleOpenCreate}>
              Fahrzeug anlegen
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {canCloneStock && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Quellfahrzeug"
                value={cloneSource}
                onChange={(e) => setCloneSource(e.target.value)}
                fullWidth
                size="small"
              >
                {sortedVehicles.map((v: any) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.licensePlate} - {v.description}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Zielfahrzeug"
                value={cloneTarget}
                onChange={(e) => setCloneTarget(e.target.value)}
                fullWidth
                size="small"
              >
                {sortedVehicles.map((v: any) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.licensePlate} - {v.description}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyQuantities}
                    onChange={(e) => setCopyQuantities(e.target.checked)}
                  />
                }
                label="Ist-Mengen mitkopieren"
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleCloneStock}
                disabled={isCloning || sortedVehicles.length < 2}
              >
                {isCloning ? "Kopiere..." : "Bestand klonen"}
              </Button>
            </Grid>
            {cloneMessage && (
              <Grid item xs={12}>
                <Alert severity="success">{cloneMessage}</Alert>
              </Grid>
            )}
            {cloneError && (
              <Grid item xs={12}>
                <Alert severity="error">{cloneError}</Alert>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}
      <Paper sx={{ backgroundColor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kennzeichen</TableCell>
              <TableCell>Beschreibung</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedVehicles.map((vehicle: any) => (
              <TableRow key={vehicle.id} hover>
                <TableCell>{vehicle.licensePlate}</TableCell>
                <TableCell>{vehicle.description}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(vehicle.id)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(vehicle.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {sortedVehicles.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Noch keine Fahrzeuge erfasst.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingId ? "Fahrzeug bearbeiten" : "Neues Fahrzeug anlegen"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Kennzeichen"
                  name="licensePlate"
                  value={form.licensePlate}
                  onChange={handleChange}
                  fullWidth
                  required
                  inputProps={{ style: { textTransform: "uppercase" } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Beschreibung"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
              {error && (
                <Grid item xs={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Fahrzeug löschen</DialogTitle>
        <DialogContent dividers>
          Möchtest du dieses Fahrzeug wirklich entfernen?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehiclesPage;
