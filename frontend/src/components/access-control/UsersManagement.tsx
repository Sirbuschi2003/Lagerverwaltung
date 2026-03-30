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
import type { CreateUserRequest, UpdateUserRequest, UserDto, VehicleDto, RolePermissionsDto } from "../../utils/api";
import { createUser, updateUser, deleteUser, fetchUsers, fetchVehicles, fetchRolesList } from "../../utils/api";

const initialForm: CreateUserRequest = {
  username: "",
  displayName: "",
  password: "",
  email: "",
  role: "",
  vehicleId: undefined,
};

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RolePermissionsDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>(initialForm);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, rolesData, vehiclesData] = await Promise.all([
        fetchUsers(),
        fetchRolesList(),
        fetchVehicles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setVehicles(vehiclesData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Daten konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
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
    setForm({ ...initialForm, role: roles.length > 0 ? roles[0].name : "" });
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
    setError(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    if (!editingUser && form.password.trim().length < 8)
      return "Passwort muss mindestens 8 Zeichen haben.";
    if (editingUser && form.password.trim().length > 0 && form.password.trim().length < 8)
      return "Neues Passwort muss mindestens 8 Zeichen haben.";
    if (!form.role) return "Bitte Rolle auswählen.";
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
        await updateUser(editingUser.id, payload);
      } else {
        const payload: CreateUserRequest = {
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          password: form.password.trim(),
          email: form.email?.trim() || undefined,
          role: form.role,
          vehicleId: form.vehicleId,
        };
        await createUser(payload);
      }
      await loadData();
      setOpen(false);
      setEditingUser(null);
      setForm({ ...initialForm, role: roles.length > 0 ? roles[0].name : "" });
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || "Benutzer konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Benutzer konnte nicht gelöscht werden.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Verwalte Benutzer, Rollen und Fahrzeugzuordnungen.
            </Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={handleOpenCreate} disabled={roles.length === 0}>
              Benutzer anlegen
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ backgroundColor: "background.paper" }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            <Typography>Laden...</Typography>
          </Box>
        ) : sortedUsers.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">Keine Benutzer vorhanden.</Alert>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1a1a1a" }}>
                <TableCell sx={{ fontWeight: 600, color: "#fff" }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#fff" }}>Benutzername</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#fff" }}>Rolle</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#fff" }}>Fahrzeug</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "#fff" }} align="right">
                  Aktionen
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.map((user: UserDto) => {
                const vehicle = vehicles.find((v: VehicleDto) => v.id === user.vehicleId);
                return (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      {vehicle ? `${vehicle.licensePlate} - ${vehicle.description}` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Bearbeiten">
                        <IconButton size="small" onClick={() => handleOpenEdit(user)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(user)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Benutzer anlegen / bearbeiten */}
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingUser ? "Benutzer bearbeiten" : "Benutzer anlegen"}</DialogTitle>
          <DialogContent dividers>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
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
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={
                    editingUser
                      ? "Neues Passwort (optional, mind. 8 Zeichen)"
                      : "Passwort (mind. 8 Zeichen)"
                  }
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
                  <Select
                    value={form.role}
                    label="Rolle"
                    onChange={handleRoleChange}
                    required
                    disabled={roles.length === 0}
                  >
                    {roles.map((role) => (
                      <MenuItem key={role.id} value={role.name}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Fahrzeug (optional)</InputLabel>
                  <Select
                    value={form.vehicleId ?? "none"}
                    label="Fahrzeug (optional)"
                    onChange={handleVehicleChange}
                  >
                    <MenuItem value="none">- Kein Fahrzeug -</MenuItem>
                    {vehicles.map((vehicle) => (
                      <MenuItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.licensePlate} - {vehicle.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || roles.length === 0}>
              {isSubmitting ? "Speichern..." : "Speichern"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Löschen bestätigen */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Benutzer löschen</DialogTitle>
        <DialogContent>
          Möchtest du den Benutzer „{deleteTarget?.displayName}" wirklich löschen?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManagement;
