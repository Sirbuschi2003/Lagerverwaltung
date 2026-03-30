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
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ShieldIcon from "@mui/icons-material/Shield";
import type { PermissionDto, RolePermissionsDto } from "../../utils/api";
import { updateRolePermissions } from "../../utils/api";
import { permissionMeta } from "./permissionMeta";

interface RolePermissionsEditorProps {
  roles: RolePermissionsDto[];
  permissions: PermissionDto[];
  onRefresh: () => Promise<void>;
}

const RolePermissionsEditor: React.FC<RolePermissionsEditorProps> = ({ roles, permissions, onRefresh }) => {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.name || "MANAGER");
  const [localPermissions, setLocalPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentRole = useMemo(() => roles.find((r) => r.name === selectedRole), [roles, selectedRole]);

  useEffect(() => {
    if (currentRole) {
      setLocalPermissions(currentRole.permissions);
    }
  }, [currentRole]);

  const togglePermission = (key: string) => {
    setLocalPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleCategory = (permsInCategory: PermissionDto[]) => {
    const keys = permsInCategory.map((p) => p.key);
    setLocalPermissions((prev) => {
      const hasAll = keys.every((k) => prev.includes(k));
      if (hasAll) return prev.filter((p) => !keys.includes(p));
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return Array.from(next);
    });
  };

  const savePermissions = async () => {
    setWorking(true);
    setStatus(null);
    setError(null);
    try {
      await updateRolePermissions(selectedRole, localPermissions);
      setStatus("Rollenrechte gespeichert.");
      await onRefresh();
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

  const groupedPermissions = useMemo(() => {
    const q = search.toLowerCase().trim();
    const groups = new Map<string, PermissionDto[]>();
    sortedPermissions.forEach((perm) => {
      const label = permissionMeta[perm.key]?.label || perm.key;
      if (q && !label.toLowerCase().includes(q) && !perm.key.toLowerCase().includes(q)) return;
      const category = permissionMeta[perm.key]?.category || "Sonstiges";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(perm);
    });
    return Array.from(groups.entries()).map(([category, perms]) => ({ category, perms }));
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
            <Typography variant="h6">Rollenrechte bearbeiten</Typography>
            <Typography variant="caption" color="text.secondary">
              Wähle eine Rolle und setze die Berechtigungen.
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Rolle</InputLabel>
            <Select value={selectedRole} label="Rolle" onChange={(e) => setSelectedRole(e.target.value)}>
              {roles.map((role) => (
                <MenuItem key={role.name} value={role.name}>
                  {role.name}
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

        {groupedPermissions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
            Keine Berechtigungen gefunden.
          </Typography>
        )}

        <Stack spacing={2} sx={{ maxHeight: "calc(100vh - 420px)", minHeight: 300, overflow: "auto" }}>
          {groupedPermissions.map(({ category, perms }) => {
            const keys = perms.map((p) => p.key);
            const activeCount = keys.filter((k) => localPermissions.includes(k)).length;
            const allChecked = activeCount === keys.length;
            const someChecked = activeCount > 0 && !allChecked;

            return (
              <Box key={category}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
                    {category}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {activeCount} / {perms.length} aktiv
                    </Typography>
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={someChecked}
                      onChange={() => toggleCategory(perms)}
                    />
                  </Box>
                </Box>

                <Stack spacing={1.25}>
                  {perms.map((perm) => (
                    <Box
                      key={perm.key}
                      sx={{
                        border: "1px solid",
                        borderColor: localPermissions.includes(perm.key) ? "primary.main" : "divider",
                        borderRadius: 2,
                        p: 1.1,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1,
                        backgroundColor: "background.paper",
                        cursor: "pointer",
                      }}
                      onClick={() => togglePermission(perm.key)}
                    >
                      <Checkbox
                        size="small"
                        checked={localPermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
                          <ShieldIcon fontSize="small" />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {permissionMeta[perm.key]?.label ?? perm.key}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {perm.description}
                        </Typography>
                        {permissionMeta[perm.key]?.features && (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                            {permissionMeta[perm.key].features!.map((feature) => (
                              <Chip key={feature} label={feature} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Box sx={{ mt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={savePermissions} disabled={working}>
            Speichern
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RolePermissionsEditor;
