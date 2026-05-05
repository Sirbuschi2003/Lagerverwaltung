import React, { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import DatasetIcon from "@mui/icons-material/Dataset";
import StorageIcon from "@mui/icons-material/Storage";
import LogsPage from "./LogsPage";
import ArchiveManagementPage from "./ArchiveManagementPage";
import useAuthStore from "../store/useAuthStore";

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

const LogsManagementPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = !user?.branchId;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Protokolle
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<DatasetIcon />} iconPosition="start" label="Systemprotokolle" />
          {isSuperAdmin && (
            <Tab icon={<StorageIcon />} iconPosition="start" label="Protokoll-Archiv" />
          )}
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ px: 0 }}>
          <LogsPage isEmbedded />
        </Box>
      </TabPanel>

      {isSuperAdmin && (
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ px: 0 }}>
            <ArchiveManagementPage isEmbedded />
          </Box>
        </TabPanel>
      )}
    </Box>
  );
};

export default LogsManagementPage;
