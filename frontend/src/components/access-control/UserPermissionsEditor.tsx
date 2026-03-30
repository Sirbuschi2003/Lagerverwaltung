import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import ShieldIcon from "@mui/icons-material/Shield";
import BlockIcon from "@mui/icons-material/Block";
import type { PermissionDto, UserPermissionsDto, UserDto } from "../../utils/api";
import { fetchUserPermissions, updateUserPermissions, fetchUsers } from "../../utils/api";
import { permissionMeta } from "./permissionMeta";

interface UserPermissionsEditorProps {
  permissions: PermissionDto[];
}

const UserPermissionsEditor: React.FC<UserPermissionsEditorProps> = ({ permissions }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userPerms, setUserPerms] = useState<UserPermissionsDto | null>(null);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      void loadUserPermissions(selectedUserId);
    }
  }, [selectedUserId]);

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].id);
      }
    } catch {
      setError("Benutzer konnten nicht geladen werden.");
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      const data = await fetchUserPermissions(userId);
      setUserPerms({ ...data, denials: data.denials ?? [] });
    } catch {
      setError("Fehler beim Laden der Benutzerrechte");
    }
  };

  /**
   * Klick-Logik pro Berechtigung (3-Zustand-Toggle):
   * - Nicht vorhanden → GRANT-Override
   * - GRANT-Override → entfernt (zurück zu Rolle oder keine)
   * - Rolle (isFromRole, kein Deny) → DENY-Override
   * - DENY-Override → entfernt
   */
  const togglePermission = (key: string) => {
    if (!userPerms) return;
    const isOverride = userPerms.overrides.includes(key);
    const isDenied = userPerms.denials.includes(key);
    const isFromRole = userPerms.effective.includes(key) && !isDenied;

    let newOverrides = [...userPerms.overrides];
    let newDenials = [...userPerms.denials];

    if (isOverride) {
      // War GRANT-Override → entfernen
      newOverrides = newOverrides.filter((p) => p !== key);
    } else if (isDenied) {
      // War DENY → entfernen
      newDenials = newDenials.filter((p) => p !== key);
    } else if (isFromRole) {
      // Kommt von Rolle → DENY hinzufügen
      newDenials = [...newDenials, key];
    } else {
      // Hat nichts → GRANT-Override hinzufügen
      newOverrides = [...newOverrides, key];
    }

    setUserPerms({ ...userPerms, overrides: newOverrides, denials: newDenials });
  };

  const saveOverrides = async () => {
    if (!userPerms || !selectedUserId) return;
    setWorking(true);
    setStatus(null);
    setError(null);
    try {
      await updateUserPermissions(selectedUserId, userPerms.overrides, userPerms.denials);
      setStatus("Benutzerrechte gespeichert.");
      await loadUserPermissions(selectedUserId);
    } catch (err: any) {
      setError(err.response?.data?.message || "Fehler beim Speichern");
    } finally {
      setWorking(false);
    }
  };

  const sortedPermissions = useMemo(() => {
    return permissions.slice().sort((a, b) => {
      const ca = permissionMeta[a.key]?.category || "Sonstiges";
      const cb = permissionMeta[b.key]?.category || "Sonstiges";
      if (ca !== cb) return ca.localeCompare(cb, "de");
      return (permissionMeta[a.key]?.label || a.key).localeCompare(permissionMeta[b.key]?.label || b.key, "de");
    });
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sortedPermissions;
    return sortedPermissions.filter((perm) => {
      const label = permissionMeta[perm.key]?.label || perm.key;
      return label.toLowerCase().includes(q) || perm.key.toLowerCase().includes(q);
    });
  }, [sortedPermissions, search]);

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 2, gap: 1 }}
        >
          <Box>
            <Typography variant="h6">Benutzer-Overrides</Typography>
            <Typography variant="caption" color="text.secondary">
              Rechte für einzelne Benutzer erweitern oder entziehen. Klick auf Rollenrecht entzieht es.
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Benutzer</InputLabel>
            <Select value={selectedUserId} label="Benutzer" onChange={(e) => setSelectedUserId(e.target.value)}>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonIcon fontSize="small" />
                    <span>
                      {user.displayName} ({user.role})
                    </span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {status && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {status}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {userPerms && (
          <>
            <Box sx={{ mb: 2, p: 2, bgcolor: "background.default", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Rolle: <strong>{userPerms.role}</strong>
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Effektive Rechte: {userPerms.effective.length} | Zusätzlich: {userPerms.overrides.length} | Entzogen: {userPerms.denials.length}
              </Typography>
            </Box>

            <TextField
              size="small"
              placeholder="Berechtigungen suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Divider sx={{ mb: 2 }} />

            {filteredPermissions.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                Keine Berechtigungen gefunden.
              </Typography>
            )}

            <Stack spacing={1.25} sx={{ maxHeight: "calc(100vh - 480px)", minHeight: 300, overflow: "auto" }}>
              {filteredPermissions.map((perm, idx, arr) => {
                const category = permissionMeta[perm.key]?.category || "Sonstiges";
                const prevCategory = idx > 0 ? permissionMeta[arr[idx - 1].key]?.category || "Sonstiges" : null;
                const isOverride = userPerms.overrides.includes(perm.key);
                const isDenied = userPerms.denials.includes(perm.key);
                const isFromRole = userPerms.effective.includes(perm.key) && !isDenied;

                let borderColor = "divider";
                let bgColor = "background.paper";
                let tooltipTitle = "";

                if (isDenied) {
                  borderColor = "error.main";
                  bgColor = "error.50";
                  tooltipTitle = "Recht entzogen – Klick zum Wiederherstellen";
                } else if (isOverride) {
                  borderColor = "success.main";
                  tooltipTitle = "Zusätzliches Recht (Override) – Klick zum Entfernen";
                } else if (isFromRole) {
                  borderColor = "info.main";
                  bgColor = "action.hover";
                  tooltipTitle = "Kommt von der Rolle – Klick zum Entziehen";
                }

                return (
                  <Box key={perm.key}>
                    {category !== prevCategory && (
                      <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
                        {category}
                      </Typography>
                    )}
                    <Tooltip title={tooltipTitle} placement="left">
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor,
                          borderRadius: 2,
                          p: 1.1,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          backgroundColor: bgColor,
                          cursor: "pointer",
                          opacity: isDenied ? 0.7 : 1,
                        }}
                        onClick={() => togglePermission(perm.key)}
                      >
                        <Checkbox
                          size="small"
                          checked={isOverride || isFromRole}
                          indeterminate={isDenied}
                          onChange={() => togglePermission(perm.key)}
                          onClick={(e) => e.stopPropagation()}
                          sx={isDenied ? { color: "error.main" } : undefined}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
                            {isDenied ? (
                              <BlockIcon fontSize="small" color="error" />
                            ) : (
                              <ShieldIcon fontSize="small" />
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {permissionMeta[perm.key]?.label ?? perm.key}
                            </Typography>
                            {isFromRole && (
                              <Chip label="Von Rolle" size="small" color="info" variant="outlined" />
                            )}
                            {isOverride && (
                              <Chip label="Override" size="small" color="success" variant="outlined" />
                            )}
                            {isDenied && (
                              <Chip label="Entzogen" size="small" color="error" variant="outlined" />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {perm.description}
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  </Box>
                );
              })}
            </Stack>

            <Box sx={{ mt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button variant="contained" onClick={saveOverrides} disabled={working}>
                Speichern
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default UserPermissionsEditor;
