import React, { useEffect, useMemo, useState } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  Alert,
  Box,
  Button,
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
import type { CreateUserRequest, UpdateUserRequest, UserDto } from "../utils/api";

const initialForm: CreateUserRequest = {
  username: "",
  displayName: "",
  password: "",
  email: "",
  role: "TECHNICIAN",
  vehicleId: undefined,
};

const UsersPage = () => {
  const { users, loadUsers, addUser, editUser, removeUser, isLoading } = useUsersStore();
  const { vehicles, loadVehicles } = useVehiclesStore();
  const role = useAuthStore((state: any) => state.user?.role ?? null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>(initialForm);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    void loadUsers();
    void loadVehicles();
    void loadAvailableRoles();
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

  const handleOpenCreate = () => {
    setForm(initialForm);
    setEditingUser(null);
    setError(null);
    setOpen(true);
  };

  const handleOpenEdit = (user: UserDto) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      displayName: user.displayName,
      password: "",
      email: user.email ?? "",
      role: user.role,
      vehicleId: user.vehicleId ?? undefined,
    });
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

  const validate = () => {
    if (!form.username.trim()) return "Bitte Benutzernamen eingeben.";
    if (!form.displayName.trim()) return "Bitte Anzeigenamen eingeben.";
    if (!editingUser && form.password.trim().length < 6)
      return "Passwort muss mindestens 6 Zeichen haben.";
    if (editingUser && form.password.trim().length > 0 && form.password.trim().length < 6)
      return "Passwort muss mindestens 6 Zeichen haben.";
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
        };
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
              <TableCell>Fahrzeug</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.map((user: any) => {
              const vehicle = vehicles.find((v: any) => v.id === user.vehicleId);
              return (
                <TableRow key={user.id} hover>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    {availableRoles.find((r: { id: number; name: string }) => r.name === user.role)?.name ?? user.role}
                  </TableCell>
                  <TableCell>{vehicle ? `${vehicle.licensePlate} - ${vehicle.description}` : "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Bearbeiten">
                      <IconButton size="small" onClick={() => handleOpenEdit(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Löschen">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(user)}
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
                <TableCell colSpan={5} align="center">
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
                    {availableRoles.map((role: { id: number; name: string }) => (
                      <MenuItem key={role.id} value={role.name}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
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
                        {vehicle.licensePlate} ? {vehicle.description}
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
