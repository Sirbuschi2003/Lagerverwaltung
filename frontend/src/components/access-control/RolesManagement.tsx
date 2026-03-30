import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import type { RolePermissionsDto } from "../../utils/api";
import { createRole, updateRole, deleteRole } from "../../utils/api";

interface RolesManagementProps {
  roles: RolePermissionsDto[];
  onRefresh: () => Promise<void>;
}

const RolesManagement: React.FC<RolesManagementProps> = ({ roles, onRefresh }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RolePermissionsDto | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RolePermissionsDto | null>(null);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ name: "", description: "" });
    setError(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (role: RolePermissionsDto) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || "" });
    setError(null);
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingRole(null);
    setFormData({ name: "", description: "" });
    setError(null);
  };

  const handleSave = async () => {
    setWorking(true);
    setError(null);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, formData.name, formData.description);
      } else {
        await createRole(formData.name, formData.description);
      }
      await onRefresh();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Fehler beim Speichern");
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (role: RolePermissionsDto) => {
    setWorking(true);
    setError(null);
    try {
      await deleteRole(role.id);
      await onRefresh();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Fehler beim Löschen");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6">Rollen verwalten</Typography>
            <Typography variant="caption" color="text.secondary">
              Erstelle, bearbeite und lösche Rollen. Systemrollen können nicht umbenannt oder gelöscht werden.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Rolle anlegen
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Beschreibung</TableCell>
              <TableCell>Typ</TableCell>
              <TableCell>Berechtigungen</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {role.isSystem && <SecurityIcon fontSize="small" color="primary" />}
                    <Typography fontWeight={role.isSystem ? 600 : 400}>{role.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{role.description || "-"}</TableCell>
                <TableCell>
                  {role.isSystem ? (
                    <Typography variant="caption" color="primary">
                      System
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Custom
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{role.permissions.length} Rechte</TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton size="small" onClick={() => handleOpenEdit(role)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={role.isSystem ? "Systemrollen können nicht gelöscht werden" : "Löschen"}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={role.isSystem}
                        onClick={() => setDeleteConfirm(role)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Create/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editingRole ? "Rolle bearbeiten" : "Neue Rolle anlegen"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={editingRole?.isSystem}
                helperText={editingRole?.isSystem ? "Systemrollen können nicht umbenannt werden" : ""}
                fullWidth
              />
              <TextField
                label="Beschreibung"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Abbrechen</Button>
            <Button onClick={handleSave} variant="contained" disabled={working || !formData.name}>
              Speichern
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle>Rolle löschen?</DialogTitle>
          <DialogContent>
            <Typography>
              Möchtest du die Rolle "{deleteConfirm?.name}" wirklich löschen? Dies kann nicht rückgängig gemacht
              werden.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              variant="contained"
              color="error"
              disabled={working}
            >
              Löschen
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default RolesManagement;
