import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useAuthStore from "../store/useAuthStore";
import {
  createLocation,
  deleteLocation,
  fetchLocations,
  updateLocation,
  type LocationDto,
} from "../utils/api";

const DEFAULT_PARENT_STORAGE_KEY = "locations.defaultParentId";

const typeLabels: Record<string, string> = {
  WAREHOUSE: "Lager",
  SHELF: "Regal/Fach",
  BIN: "Schrank/Schublade",
  VEHICLE: "Fahrzeug",
};

const typeOptions = [
  { value: "WAREHOUSE", label: typeLabels.WAREHOUSE },
  { value: "SHELF", label: typeLabels.SHELF },
  { value: "BIN", label: typeLabels.BIN },
];

type LocationFormState = {
  type: string;
  code: string;
  name: string;
  groupNumber: string;
  slotNumber: string;
  parentId: string;
};

const initialFormState: LocationFormState = {
  type: "SHELF",
  code: "",
  name: "",
  groupNumber: "",
  slotNumber: "",
  parentId: "",
};

const getNumberFieldLabels = (type: string) => {
  if (type === "BIN") {
    return {
      group: "Schrank Nummer",
      slot: "Schublade Nummer",
    };
  }
  return {
    group: "Regal Nummer",
    slot: "Fach Nummer",
  };
};

const buildStructuredLocationName = (
  type: string,
  groupNumber: string,
  slotNumber: string,
): string => {
  const group = groupNumber.trim();
  const slot = slotNumber.trim();
  if (!group || !slot) return "";

  if (type === "BIN") {
    return `Schrank ${group} / Schublade ${slot}`;
  }
  if (type === "SHELF") {
    return `Regal ${group} / Fach ${slot}`;
  }
  return "";
};

const parseStructuredNumbers = (
  type: string,
  name?: string | null,
): { groupNumber: string; slotNumber: string } => {
  const raw = name?.trim() ?? "";
  if (!raw) {
    return { groupNumber: "", slotNumber: "" };
  }

  const pattern =
    type === "BIN"
      ? /Schrank\s*(\d+)\s*\/\s*Schublade\s*(\d+)/i
      : /Regal\s*(\d+)\s*\/\s*Fach\s*(\d+)/i;
  const namedMatch = raw.match(pattern);
  if (namedMatch) {
    return { groupNumber: namedMatch[1], slotNumber: namedMatch[2] };
  }

  const genericMatch = raw.match(/(\d+)\D+(\d+)/);
  if (genericMatch) {
    return { groupNumber: genericMatch[1], slotNumber: genericMatch[2] };
  }

  return { groupNumber: "", slotNumber: "" };
};

const LocationsPage = () => {
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const canCreate = hasPermission("locations.create");
  const canEdit = hasPermission("locations.edit");
  const canDelete = hasPermission("locations.delete");

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [hasLoadedLocations, setHasLoadedLocations] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LocationDto | null>(null);
  const [form, setForm] = useState<LocationFormState>(initialFormState);
  const [defaultParentId, setDefaultParentId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(DEFAULT_PARENT_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LocationDto | null>(null);

  const loadLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLocations({ includeVehicles: false });
      setLocations(data);
    } catch (err) {
      console.error(err);
      setError("Lagerorte konnten nicht geladen werden.");
    } finally {
      setHasLoadedLocations(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLocations();
  }, []);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.code.localeCompare(b.code, "de", { sensitivity: "base" });
    });
  }, [locations]);

  const locationOptions = useMemo(
    () => sortedLocations.filter((loc) => loc.type !== "VEHICLE"),
    [sortedLocations],
  );

  const locationById = useMemo(() => {
    const map = new Map<string, LocationDto>();
    for (const location of locationOptions) {
      map.set(location.id, location);
    }
    return map;
  }, [locationOptions]);

  const getLocationPath = (loc?: LocationDto | null) => {
    if (!loc) return "";

    const pathParts: string[] = [];
    const seen = new Set<string>();
    let current: LocationDto | null | undefined = loc;

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      pathParts.push(current.code);
      const parentId: string | undefined = current.parent?.id;
      current = parentId ? (locationById.get(parentId) ?? current.parent) : null;
    }

    return pathParts.reverse().join(" / ");
  };

  const getLocationLabel = (loc?: LocationDto | null) => {
    if (!loc) return "";
    const path = getLocationPath(loc);
    const namePart = loc.name ? ` (${loc.name})` : "";
    return `${path}${namePart}`;
  };

  const setDefaultParent = (id: string) => {
    setDefaultParentId(id);
    if (typeof window === "undefined") return;
    try {
      if (id) {
        localStorage.setItem(DEFAULT_PARENT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(DEFAULT_PARENT_STORAGE_KEY);
      }
    } catch (storageError) {
      console.warn(
        "[LocationsPage] Standard-Parent konnte nicht gespeichert werden",
        storageError,
      );
    }
  };

  useEffect(() => {
    if (!defaultParentId) return;
    if (!hasLoadedLocations) return;
    const exists = locationOptions.some((loc) => loc.id === defaultParentId);
    if (exists) return;
    setDefaultParentId("");
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(DEFAULT_PARENT_STORAGE_KEY);
    } catch (storageError) {
      console.warn(
        "[LocationsPage] Standard-Parent konnte nicht entfernt werden",
        storageError,
      );
    }
  }, [defaultParentId, hasLoadedLocations, locationOptions]);

  const handleOpenCreate = () => {
    setForm({ ...initialFormState, parentId: defaultParentId });
    setEditing(null);
    setError(null);
    setOpen(true);
  };

  const handleOpenEdit = (loc: LocationDto) => {
    const parsedNumbers = parseStructuredNumbers(loc.type, loc.name);
    setForm({
      type: loc.type,
      code: loc.code ?? "",
      name: loc.name ?? "",
      groupNumber: parsedNumbers.groupNumber,
      slotNumber: parsedNumbers.slotNumber,
      parentId: loc.parent?.id ?? "",
    });
    setEditing(loc);
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setEditing(null);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    if (name === "groupNumber" || name === "slotNumber") {
      const onlyDigits = value.replace(/\D+/g, "");
      setForm((prev) => ({ ...prev, [name]: onlyDigits }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.type) return "Bitte Typ wählen.";
    if (editing && !form.code.trim()) return "Bitte Code eingeben.";
    const isStructuredType = form.type === "SHELF" || form.type === "BIN";
    if (!isStructuredType) return null;

    const groupNumber = form.groupNumber.trim();
    const slotNumber = form.slotNumber.trim();
    if (!groupNumber && !slotNumber) return null;
    if (!groupNumber) return "Bitte erste Nummer (Regal/Schrank) eingeben.";
    if (!slotNumber) return "Bitte zweite Nummer (Fach/Schublade) eingeben.";
    if (!/^\d+$/.test(groupNumber) || !/^\d+$/.test(slotNumber)) {
      return "Bitte nur Zahlen in den Nummernfeldern eingeben.";
    }
    return null;
  };

  const nameHelperText = useMemo(() => {
    const isStructuredType = form.type === "SHELF" || form.type === "BIN";
    if (!isStructuredType) return undefined;

    const labels = getNumberFieldLabels(form.type);
    const groupNumber = form.groupNumber.trim();
    const slotNumber = form.slotNumber.trim();
    const structuredName = buildStructuredLocationName(
      form.type,
      form.groupNumber,
      form.slotNumber,
    );

    if (!groupNumber && !slotNumber) {
      return `Nummern eingeben: ${labels.group} + ${labels.slot}. Name wird automatisch gesetzt.`;
    }

    if (!groupNumber || !slotNumber) {
      return `Bitte beide Felder fuellen: ${labels.group} und ${labels.slot}.`;
    }

    if (structuredName) {
      return `Wird gespeichert als: ${structuredName}`;
    }

    return undefined;
  }, [form.groupNumber, form.slotNumber, form.type]);

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
      const code = form.code.trim();
      const structuredName = buildStructuredLocationName(
        form.type,
        form.groupNumber,
        form.slotNumber,
      );
      const resolvedName = structuredName || form.name.trim();
      const payload = {
        type: form.type,
        code: code || undefined,
        name: resolvedName || undefined,
        parentId: form.parentId ? form.parentId : undefined,
      };

      if (editing) {
        await updateLocation(editing.id, {
          code,
          name: payload.name,
          parentId: payload.parentId ?? null,
        });
      } else {
        await createLocation(payload);
      }
      await loadLocations();
      setOpen(false);
      setEditing(null);
    } catch (submitError) {
      console.error(submitError);
      setError("Lagerort konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLocation(deleteTarget.id);
      await loadLocations();
    } catch (err) {
      console.error(err);
      setError("Lagerort konnte nicht gelöscht werden.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Lagerorte
      </Typography>
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Regale, Fächer und Schubladen verwalten. Jeder Artikel kann genau
              einem Lagerplatz zugeordnet werden.
            </Typography>
          </Grid>
          {canCreate && (
            <Grid item>
              <Button variant="contained" onClick={handleOpenCreate}>
                Lagerort anlegen
              </Button>
            </Grid>
          )}
          {canCreate && (
            <Grid item xs={12}>
              <Autocomplete
                options={locationOptions}
                value={
                  locationOptions.find((loc) => loc.id === defaultParentId) ?? null
                }
                onChange={(_, value) => setDefaultParent(value?.id ?? "")}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(option) => getLocationLabel(option)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Standard-Parent für neue Lagerorte"
                    helperText="Wird beim Anlegen automatisch vorausgewählt."
                  />
                )}
              />
            </Grid>
          )}
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ backgroundColor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Typ</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Parent</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedLocations.map((loc) => (
              <TableRow key={loc.id} hover>
                <TableCell>{typeLabels[loc.type] ?? loc.type}</TableCell>
                <TableCell>{loc.code}</TableCell>
                <TableCell>{loc.name || "-"}</TableCell>
                <TableCell>{loc.parent ? getLocationLabel(loc.parent) : "-"}</TableCell>
                <TableCell align="right">
                  {canEdit && (
                    <Tooltip title="Bearbeiten">
                      <IconButton size="small" onClick={() => handleOpenEdit(loc)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Löschen">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(loc)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && sortedLocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Keine Lagerorte vorhanden.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Lade Lagerorte...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? "Lagerort bearbeiten" : "Lagerort anlegen"}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Typ"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  fullWidth
                  required
                  disabled={Boolean(editing)}
                >
                  {typeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={editing ? "Code" : "Code (optional)"}
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  fullWidth
                  required={Boolean(editing)}
                  helperText={editing ? undefined : "Leer lassen = automatisch generieren"}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  fullWidth
                  helperText={nameHelperText}
                />
              </Grid>
              {(form.type === "SHELF" || form.type === "BIN") && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={getNumberFieldLabels(form.type).group}
                    name="groupNumber"
                    value={form.groupNumber}
                    onChange={handleChange}
                    fullWidth
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  />
                </Grid>
              )}
              {(form.type === "SHELF" || form.type === "BIN") && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={getNumberFieldLabels(form.type).slot}
                    name="slotNumber"
                    value={form.slotNumber}
                    onChange={handleChange}
                    fullWidth
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <Autocomplete
                  options={locationOptions.filter((loc) => loc.id !== editing?.id)}
                  value={
                    locationOptions.find((loc) => loc.id === form.parentId) ?? null
                  }
                  onChange={(_, value) =>
                    setForm((prev) => ({
                      ...prev,
                      parentId: value?.id ?? "",
                    }))
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => getLocationLabel(option)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Übergeordneter Lagerort (optional)"
                    />
                  )}
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
        <DialogTitle>Lagerort löschen</DialogTitle>
        <DialogContent dividers>
          Soll der Lagerort wirklich entfernt werden? Zugeordnete Artikel verlieren
          dann die Lagerplatz-Referenz.
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

export default LocationsPage;

