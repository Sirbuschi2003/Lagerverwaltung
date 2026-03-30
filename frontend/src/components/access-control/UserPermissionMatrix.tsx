import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
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
import type { PermissionDto, UserDto } from "../../utils/api";
import { fetchUserPermissions, fetchUsers, updateUserPermissions } from "../../utils/api";
import { permissionMeta } from "./permissionMeta";

interface UserPermData {
  role: string;
  overrides: string[];
  denials: string[];
  roleBase: string[]; // Stabile Snapshot der Rollenrechte beim Laden
}

type CellState = "none" | "fromRole" | "grant" | "denied";

interface UserPermissionMatrixProps {
  permissions: PermissionDto[];
}

const ROLE_COLOR: Record<string, "default" | "primary" | "secondary" | "warning"> = {
  MANAGER: "primary",
  WAREHOUSE: "secondary",
  TECHNICIAN: "warning",
};

const UserPermissionMatrix: React.FC<UserPermissionMatrixProps> = ({ permissions }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [userPermsMap, setUserPermsMap] = useState<Map<string, UserPermData>>(new Map());
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, { overrides: string[]; denials: string[] }>
  >(new Map());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const changeCount = pendingChanges.size;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await fetchUsers();
      setUsers(allUsers);

      const permsResults = await Promise.all(
        allUsers.map((u) => fetchUserPermissions(u.id).then((p) => ({ userId: u.id, data: p })))
      );

      const map = new Map<string, UserPermData>();
      permsResults.forEach(({ userId, data }) => {
        map.set(userId, {
          role: data.role,
          overrides: data.overrides,
          denials: data.denials,
          // Rollenrechte = effektive Rechte minus Grant-Overrides
          roleBase: data.effective.filter((p) => !data.overrides.includes(p)),
        });
      });
      setUserPermsMap(map);
      setPendingChanges(new Map());
    } catch {
      setError("Benutzerrechte konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getCurrentPerms = (userId: string) => {
    const base = userPermsMap.get(userId) ?? { role: "", overrides: [], denials: [], roleBase: [] };
    const pending = pendingChanges.get(userId);
    return {
      overrides: pending?.overrides ?? base.overrides,
      denials: pending?.denials ?? base.denials,
      roleBase: base.roleBase,
    };
  };

  const getCellState = (userId: string, permKey: string): CellState => {
    const { overrides, denials, roleBase } = getCurrentPerms(userId);
    if (denials.includes(permKey)) return "denied";
    if (overrides.includes(permKey)) return "grant";
    if (roleBase.includes(permKey)) return "fromRole";
    return "none";
  };

  const isCellDirty = (userId: string, permKey: string): boolean => {
    if (!pendingChanges.has(userId)) return false;
    const original = userPermsMap.get(userId);
    if (!original) return false;
    const { overrides, denials } = getCurrentPerms(userId);
    const origState: CellState = original.denials.includes(permKey)
      ? "denied"
      : original.overrides.includes(permKey)
      ? "grant"
      : original.roleBase.includes(permKey)
      ? "fromRole"
      : "none";
    const currState = getCellState(userId, permKey);
    return origState !== currState;
  };

  const toggleCell = (userId: string, permKey: string) => {
    const state = getCellState(userId, permKey);
    const { overrides, denials } = getCurrentPerms(userId);
    let newOverrides = [...overrides];
    let newDenials = [...denials];

    if (state === "none") {
      newOverrides = [...newOverrides, permKey];
    } else if (state === "grant") {
      newOverrides = newOverrides.filter((p) => p !== permKey);
    } else if (state === "fromRole") {
      newDenials = [...newDenials, permKey];
    } else if (state === "denied") {
      newDenials = newDenials.filter((p) => p !== permKey);
    }

    const original = userPermsMap.get(userId);
    const isSame =
      original &&
      newOverrides.length === original.overrides.length &&
      newOverrides.every((p) => original.overrides.includes(p)) &&
      newDenials.length === original.denials.length &&
      newDenials.every((p) => original.denials.includes(p));

    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (isSame) next.delete(userId);
      else next.set(userId, { overrides: newOverrides, denials: newDenials });
      return next;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await Promise.all(
        Array.from(pendingChanges.entries()).map(([userId, { overrides, denials }]) =>
          updateUserPermissions(userId, overrides, denials)
        )
      );
      setSuccessMsg(`${changeCount} Benutzer gespeichert.`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2, gap: 1 }}
        >
          <Box>
            <Typography variant="h6">Benutzer-Overrides</Typography>
            <Typography variant="caption" color="text.secondary">
              Alle Benutzer auf einen Blick. Klick auf Rollenrecht (blau) entzieht es. Klick auf leer fügt Override hinzu.
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

        {/* Legende */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Checkbox size="small" checked disabled sx={{ color: "info.main", "&.Mui-checked": { color: "info.main" }, p: 0 }} />
            <Typography variant="caption" color="text.secondary">Von Rolle</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Checkbox size="small" checked disabled sx={{ color: "success.main", "&.Mui-checked": { color: "success.main" }, p: 0 }} />
            <Typography variant="caption" color="text.secondary">Override (zusätzlich)</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Checkbox size="small" indeterminate disabled sx={{ color: "error.main", p: 0 }} />
            <Typography variant="caption" color="text.secondary">Entzogen</Typography>
          </Stack>
        </Stack>

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

        {loading && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            Lade Benutzerrechte…
          </Typography>
        )}

        {!loading && groupedPermissions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            Keine Berechtigungen gefunden.
          </Typography>
        )}

        {!loading && users.length > 0 && (
          <TableContainer sx={{ maxHeight: "calc(100vh - 420px)", overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      minWidth: 200,
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
                  {users.map((user) => (
                    <TableCell
                      key={user.id}
                      align="center"
                      sx={{
                        minWidth: 120,
                        fontWeight: 700,
                        backgroundColor: pendingChanges.has(user.id)
                          ? "warning.dark"
                          : "background.paper",
                        color: pendingChanges.has(user.id) ? "warning.contrastText" : "inherit",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {user.displayName}
                      </Typography>
                      <Chip
                        label={userPermsMap.get(user.id)?.role ?? user.role}
                        size="small"
                        color={ROLE_COLOR[user.role] ?? "default"}
                        variant="outlined"
                        sx={{ mt: 0.3, height: 18, fontSize: "0.65rem" }}
                      />
                      {pendingChanges.has(user.id) && (
                        <Typography variant="caption" display="block" sx={{ opacity: 0.85, fontSize: "0.65rem" }}>
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
                    <TableRow>
                      <TableCell
                        colSpan={users.length + 1}
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

                        {users.map((user) => {
                          const state = getCellState(user.id, perm.key);
                          const dirty = isCellDirty(user.id, perm.key);

                          const tooltipText =
                            state === "fromRole"
                              ? "Von Rolle – Klick zum Entziehen"
                              : state === "grant"
                              ? "Override – Klick zum Entfernen"
                              : state === "denied"
                              ? "Entzogen – Klick zum Wiederherstellen"
                              : "Kein Recht – Klick zum Hinzufügen";

                          const checkboxSx =
                            dirty
                              ? { color: "warning.main", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "warning.main" } }
                              : state === "fromRole"
                              ? { color: "info.main", "&.Mui-checked": { color: "info.main" } }
                              : state === "grant"
                              ? { color: "success.main", "&.Mui-checked": { color: "success.main" } }
                              : state === "denied"
                              ? { color: "error.main", "&.MuiCheckbox-indeterminate": { color: "error.main" } }
                              : {};

                          return (
                            <TableCell key={user.id} align="center" padding="checkbox">
                              <Tooltip title={tooltipText} placement="top">
                                <Checkbox
                                  size="small"
                                  checked={state === "grant" || state === "fromRole"}
                                  indeterminate={state === "denied"}
                                  onChange={() => toggleCell(user.id, perm.key)}
                                  disabled={saving}
                                  sx={checkboxSx}
                                />
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
        )}
      </CardContent>
    </Card>
  );
};

export default UserPermissionMatrix;
