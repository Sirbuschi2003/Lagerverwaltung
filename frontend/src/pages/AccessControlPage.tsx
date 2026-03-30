import React, { useEffect, useState } from "react";
import { Alert, Box, Tab, Tabs, Typography } from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import TuneIcon from "@mui/icons-material/Tune";
import PeopleIcon from "@mui/icons-material/People";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import SecurityIcon from "@mui/icons-material/Security";
import { fetchPermissions, fetchRolePermissions, type PermissionDto, type RolePermissionsDto } from "../utils/api";
import RolesManagement from "../components/access-control/RolesManagement";
import RolePermissionMatrix from "../components/access-control/RolePermissionMatrix";
import UserPermissionMatrix from "../components/access-control/UserPermissionMatrix";
import UsersManagement from "../components/access-control/UsersManagement";
import VehiclesPage from "./VehiclesPage";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const AccessControlPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [roles, setRoles] = useState<RolePermissionsDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void refreshData();
  }, []);

  const refreshData = async () => {
    setLoadError(null);
    try {
      const [perms, rolesData] = await Promise.all([fetchPermissions(), fetchRolePermissions()]);
      setPermissions(perms);
      setRoles(rolesData);
    } catch {
      setLoadError("Rechte-Daten konnten nicht geladen werden.");
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Benutzer & Fahrzeuge
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<PeopleIcon />} iconPosition="start" label="Benutzer" />
          <Tab icon={<SecurityIcon />} iconPosition="start" label="Rollen verwalten" />
          <Tab icon={<TableChartIcon />} iconPosition="start" label="Rollenrechte-Matrix" />
          <Tab icon={<TuneIcon />} iconPosition="start" label="Benutzer-Overrides" />
          <Tab icon={<DirectionsCarIcon />} iconPosition="start" label="Fahrzeuge" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <UsersManagement />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <RolesManagement roles={roles} onRefresh={refreshData} />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <RolePermissionMatrix roles={roles} permissions={permissions} onRefresh={refreshData} />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <UserPermissionMatrix permissions={permissions} />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <VehiclesPage />
      </TabPanel>
    </Box>
  );
};

export default AccessControlPage;
