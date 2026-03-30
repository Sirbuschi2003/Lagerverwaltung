import React, { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  InputAdornment,
  Stack,
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
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import type { PermissionDto, RolePermissionsDto } from "../../utils/api";
import { updateRolePermissions } from "../../utils/api";
import { permissionMeta } from "./permissionMeta";

// Permissions die nur bestimmten Rollen zugewiesen werden dürfen (Backend-seitig eingeschränkt)
const RESTRICTED_PERMISSIONS: Record<string, string[]> = {
  "backup.access": ["MANAGER"],
};

interface RolePermissionMatrixProps {
  roles: RolePermissionsDto[];
  permissions: PermissionDto[];
  onRefresh: () => Promise<void>;
}

const RolePermissionMatrix: React.FC<RolePermissionMatrixProps> = ({ roles, permissions, onRefresh }) => {
  // pendingChanges: Map<roleName, neue Permissions-Liste>
  const [pendingChanges, setPendingChanges] = useState<Map<string, string[]>>(new Map());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const changeCount = pendingChanges.size;

  // Aktuelle Permissions für eine Rolle (pending hat Vorrang)
  const getPermsForRole = (role: RolePermissionsDto): string[] => {
    return pendingChanges.get(role.name) ?? role.permissions;
  };

  const toggleCell = (role: RolePermissionsDto, permKey: string) => {
    const current = getPermsForRole(role);
    const newPerms = current.includes(permKey)
      ? current.filter((p) => p !== permKey)
      : [...current, permKey];

    // Wenn gleich wie Original → pending-Eintrag entfernen
    const original = role.permissions;
    const isSame =
      newPerms.length === original.length &&
      newPerms.every((p) => original.includes(p));

    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (isSame) next.delete(role.name);
      else next.set(role.name, newPerms);
      return next;
    });
  };

  const isRestricted = (role: RolePermissionsDto, permKey: string): boolean => {
    const allowedRoles = RESTRICTED_PERMISSIONS[permKey];
    return !!allowedRoles && !allowedRoles.includes(role.name);
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await Promise.all(
        Array.from(pendingChanges.entries()).map(([roleName, perms]) =>
          updateRolePermissions(roleName, perms)
        )
      );
      setPendingChanges(new Map());
      setSuccessMsg(`${changeCount} Rolle(n) gespeichert.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  // Sortierte & gefilterte Permissions gruppiert nach Kategorie
  const groupedPermissions = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = permissions.slice().sort((a, b) => {
      const ca = permissionMeta[a.key]?.category || "Sonstiges";
      const cb = permissionMeta[b.key]?.category || "Sonstiges";
      if (ca !== cb) return ca.localeCompare(cb, "de");
      return (permissionMeta[a.key]?.label || a.key).localeCompare(
        permissionMeta[b.key]?.label || b.key,
        "de"
      );
    });

    const groups = new Map<string, PermissionDto[]>();
    sorted.forEach((perm) => {
      const label = permissionMeta[perm.key]?.label || perm.key;
      if (q && !label.toLowerCase().includes(q) && !perm.key.toLowerCase().includes(q)) return;
      const category = permissionMeta[perm.key]?.category || "Sonstiges";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(perm);
    });
    return Array.from(groups.entries());
  }, [permissions, search]);

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 1 }}>
          <Box>
            <Typography variant="h6">Rechte-Matrix</Typography>
            <Typography variant="caption" color="text.secondary">
              Alle Rollen und Berechtigungen auf einen Blick. Klicke eine Zelle zum Ändern.
            </Typography>
          </Box>
          <Badge badgeContent={changeCount} color="warning" invisible={changeCount === 0}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveAll}
              disabled={saving || changeCount === 0}
            >
              {changeCount > 0 ? `${changeCount} Änderung(en) speichern` : "Keine Änderungen"}
            </Button>
          </Badge>
        </Stack>

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
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

        {groupedPermissions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            Keine Berechtigungen gefunden.
          </Typography>
        )}

        <TableContainer sx={{ maxHeight: "calc(100vh - 380px)", overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    minWidth: 220,
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    backgroundColor: "background.paper",
                    fontWeight: 700,
                    borderRight: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  Berechtigung
                </TableCell>
                {roles.map((role) => (
                  <TableCell
                    key={role.name}
                    align="center"
                    sx={{
                      fontWeight: 700,
                      minWidth: 110,
                      whiteSpace: "nowrap",
                      backgroundColor: pendingChanges.has(role.name)
                        ? "warning.dark"
                        : "background.paper",
                      color: pendingChanges.has(role.name) ? "warning.contrastText" : "inherit",
                    }}
                  >
                    {role.name}
                    {pendingChanges.has(role.name) && (
                      <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                        geändert
                      </Typography>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedPermissions.map(([category, perms]) => (
                <React.Fragment key={category}>
                  {/* Kategorie-Header */}
                  <TableRow>
                    <TableCell
                      colSpan={roles.length + 1}
                      sx={{
                        backgroundColor: "action.selected",
                        fontWeight: 700,
                        py: 0.75,
                        position: "sticky",
                        left: 0,
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        {category}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Permissions in dieser Kategorie */}
                  {perms.map((perm) => (
                    <TableRow key={perm.key} hover>
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 0,
                          backgroundColor: "background.paper",
                          zIndex: 1,
                          borderRight: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {permissionMeta[perm.key]?.label ?? perm.key}
                        </Typography>
                        {perm.description && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {perm.description}
                          </Typography>
                        )}
                      </TableCell>

                      {roles.map((role) => {
                        const restricted = isRestricted(role, perm.key);
                        const checked = getPermsForRole(role).includes(perm.key);
                        const isDirty =
                          pendingChanges.has(role.name) &&
                          checked !== role.permissions.includes(perm.key);

                        return (
                          <TableCell key={role.name} align="center" padding="checkbox">
                            <Tooltip
                              title={
                                restricted
                                  ? `Nur für ${RESTRICTED_PERMISSIONS[perm.key]!.join(", ")} erlaubt`
                                  : ""
                              }
                              placement="top"
                            >
                              <span>
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  disabled={restricted || saving}
                                  onChange={() => toggleCell(role, perm.key)}
                                  sx={
                                    isDirty
                                      ? {
                                          color: "warning.main",
                                          "&.Mui-checked": { color: "warning.main" },
                                        }
                                      : {}
                                  }
                                />
                              </span>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default RolePermissionMatrix;
