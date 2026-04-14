import React, { useEffect, useMemo, useState } from "react";
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
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import useUsersStore from "../store/useUsersStore";
import useVehiclesStore from "../store/useVehiclesStore";
import useAuthStore from "../store/useAuthStore";
import { fetchBranches, fetchWarehouses, type BranchDto, type WarehouseDto, type CreateUserRequest, type UpdateUserRequest, type UserDto } from "../utils/api";

const initialForm: CreateUserRequest = {
  username: "",
  displayName: "",
  password: "",
  email: "",
  role: "TECHNICIAN",
  vehicleId: undefined,
  branchId: undefined,
  warehouseId: undefined,
};

const UsersPage = () => {
  const { users, loadUsers, addUser, editUser, removeUser, isLoading } = useUsersStore();
  const { vehicles, loadVehicles } = useVehiclesStore();
  const user = useAuthStore((state: any) => state.user);
  const role = user?.role ?? null;
  const isSuperAdmin = role === "MANAGER" && user?.branchId === null;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>(initialForm);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);

  useEffect(() => {
    void loadUsers();
    void loadVehicles();
    void loadAvailableRoles();
    if (isSuperAdmin) {
      fetchBranches().then(setBranches).catch(() => {});
    } else if (user?.branchId) {
      // Branch-Manager: Lager seiner Niederlassung laden
      fetchWarehouses({ branchId: user.branchId }).then(setWarehouses).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const response = await fetch("/api/access-control/roles/list", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data);
      }
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  };

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" }),
      ),
    [users],
  );

  const branchById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const handleOpenCreate = () => {
    setForm(initialForm);
    setEditingUser(null);
    setError(null);
    setOpen(true);
  };

  const handleOpenEdit = (u: UserDto) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      displayName: u.displayName,
      password: "",
      email: u.email ?? "",
      role: u.role,
      vehicleId: u.vehicleId ?? undefined,
      branchId: u.branchId ?? undefined,
      warehouseId: (u as any).warehouseId ?? undefined,
    });
    // Lager der Niederlassung des Benutzers laden
    const branchToLoad = u.branchId ?? user?.branchId;
    if (branchToLoad) {
      fetchWarehouses({ branchId: branchToLoad }).then(setWarehouses).catch(() => {});
    }
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setEditingUser(null);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (event: SelectChangeEvent<string>) => {
    setForm((prev: any) => ({ ...prev, role: event.target.value }));
  };

  const handleVehicleChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setForm((prev: any) => ({ ...prev, vehicleId: value === "none" ? undefined : value }));
  };

  const handleBranchChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    const newBranchId = value === "superadmin" ? null : value || undefined;
    setForm((prev: any) => ({ ...prev, branchId: newBranchId, warehouseId: undefined }));
    // Lager der gewählten Niederlassung laden
    if (newBranchId) {
      fetchWarehouses({ branchId: newBranchId }).then(setWarehouses).catch(() => {});
    } else {
      setWarehouses([]);
    }
  };

  const handleWarehouseChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setForm((prev: any) => ({ ...prev, warehouseId: value === "none" ? null : value || undefined }));
  };

  const validate = () => {
    if (!form.username.trim()) return "Bitte Benutzernamen eingeben.";
    if (!form.displayName.trim()) return "Bitte Anzeigenamen eingeben.";
    if (!editingUser && form.password.trim().length < 6)
      return "Passwort muss mindestens 6 Zeichen haben.";
    if (editingUser && form.password.trim().length > 0 && form.password.trim().length < 6)
      return "Passwort muss mindestens 6 Zeichen haben.";
    if (isSuperAdmin && !editingUser && form.branchId === undefined)
      return "Bitte eine Niederlassung auswählen.";
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

    try {
      if (editingUser) {
        const payload: UpdateUserRequest = {
          displayName: form.displayName.trim(),
          email: form.email?.trim() || undefined,
          role: form.role,
          vehicleId: form.vehicleId ?? null,
          warehouseId: form.warehouseId ?? null,
        };
        if (isSuperAdmin && form.branchId !== undefined) {
          payload.branchId = form.branchId;
        }
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }
        await editUser(editingUser.id, payload);
      } else {
        const payload: CreateUserRequest = {
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          password: form.password.trim(),
          email: form.email?.trim() || undefined,
          role: form.role,
          vehicleId: form.vehicleId,
          branchId: form.branchId,
          warehouseId: form.warehouseId ?? null,
        };
        await addUser(payload);
      }
      setOpen(false);
      setEditingUser(null);
      setForm(initialForm);
    } catch (submitError) {
      console.error(submitError);
      setError("Benutzer konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeUser(deleteTarget.id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (role !== "MANAGER") {
    return (
      <Alert severity="info">
        Diese Seite steht nur Mitgliedern der Leitung zur Verfügung.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Benutzerverwaltung
      </Typography>
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Verwalte Benutzer, Rollen und Fahrzeugzuordnungen.
            </Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={handleOpenCreate}>
              Benutzer anlegen
            </Button>
          </Grid>
        </Grid>
      </Paper>
      <Paper sx={{ backgroundColor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Benutzername</TableCell>
              <TableCell>Rolle</TableCell>
              {isSuperAdmin && <TableCell>Niederlassung</TableCell>}
              <TableCell>Lager</TableCell>
              <TableCell>Fahrzeug</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.map((u: any) => {
              const vehicle = vehicles.find((v: any) => v.id === u.vehicleId);
              return (
                <TableRow key={u.id} hover>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>
                    {availableRoles.find((r: { id: number; name: string }) => r.name === u.role)?.name ?? u.role}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      {u.branchId === null ? (
                        <Chip label="Super-Admin" size="small" color="warning" variant="outlined" />
                      ) : (
                        <Typography variant="body2">
                          {branchById.get(u.branchId) ?? u.branchId}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {(u as any).warehouseId ? (
                      <Chip
                        label={warehouses.find((w) => w.id === (u as any).warehouseId)?.name ?? (u as any).warehouseId}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">–</Typography>
                    )}
                  </TableCell>
                  <TableCell>{vehicle ? `${vehicle.licensePlate} - ${vehicle.description}` : "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Bearbeiten">
                      <IconButton size="small" onClick={() => handleOpenEdit(u)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Löschen">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedUsers.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} align="center">
                  Noch keine Benutzer angelegt.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingUser ? "Benutzer bearbeiten" : "Benutzer anlegen"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {!editingUser && (
                <Grid item xs={12}>
                  <TextField
                    label="Benutzername"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    fullWidth
                    required
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  label="Anzeigename"
                  name="displayName"
                  value={form.displayName}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="E-Mail (optional)"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={editingUser ? "Neues Passwort (optional)" : "Passwort"}
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  fullWidth
                  required={!editingUser}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Rolle</InputLabel>
                  <Select value={form.role} label="Rolle" onChange={handleRoleChange}>
                    {availableRoles.map((r: { id: number; name: string }) => (
                      <MenuItem key={r.id} value={r.name}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {isSuperAdmin && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required={!editingUser}>
                    <InputLabel>Niederlassung *</InputLabel>
                    <Select
                      value={form.branchId === null ? "superadmin" : (form.branchId ?? "")}
                      label="Niederlassung *"
                      onChange={handleBranchChange}
                    >
                      <MenuItem value="superadmin">
                        <em>Super-Admin (keine Niederlassung)</em>
                      </MenuItem>
                      {branches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {/* Lager-Zuweisung: sichtbar wenn Niederlassung gewählt und Lager vorhanden */}
              {(form.branchId || (!isSuperAdmin && warehouses.length > 0)) && warehouses.length > 0 && (
                <Grid item xs={12} sm={isSuperAdmin ? 6 : 6}>
                  <FormControl fullWidth>
                    <InputLabel>Lager</InputLabel>
                    <Select
                      value={form.warehouseId ?? "none"}
                      label="Lager"
                      onChange={handleWarehouseChange}
                    >
                      <MenuItem value="none"><em>Kein Lager (Manager sieht alle)</em></MenuItem>
                      {warehouses.map((w) => (
                        <MenuItem key={w.id} value={w.id}>
                          {w.name}{w.code ? ` (${w.code})` : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={isSuperAdmin ? 12 : 6}>
                <FormControl fullWidth>
                  <InputLabel>Fahrzeug</InputLabel>
                  <Select
                    value={form.vehicleId ?? "none"}
                    label="Fahrzeug"
                    onChange={handleVehicleChange}
                  >
                    <MenuItem value="none">Keines</MenuItem>
                    {vehicles.map((vehicle: any) => (
                      <MenuItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.licensePlate} - {vehicle.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
        <DialogTitle>Benutzer löschen</DialogTitle>
        <DialogContent dividers>
          Möchtest du den Benutzer "{deleteTarget?.displayName}" wirklich entfernen?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
