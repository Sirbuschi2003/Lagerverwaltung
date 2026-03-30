import React, { useEffect, useMemo, useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import TableChartIcon from "@mui/icons-material/TableChart";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { useLocation } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import InventoryTemplateSettingsPage from "./InventoryTemplateSettingsPage";
import PurchaseOrderEmailTemplatePage from "./PurchaseOrderEmailTemplatePage";
import PurchaseOrderTemplatePage from "./PurchaseOrderTemplatePage";
import PdfTemplateBuilderPage from "./PdfTemplateBuilderPage";

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

const WarehouseSettingsPage: React.FC = () => {
  const location = useLocation();
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const canManageInventoryTemplate = hasPermission("inventory.template");
  const [tabValue, setTabValue] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "mail-template",
        icon: <MailOutlineIcon />,
        label: "E-Mail-Vorlagen",
        content: <PurchaseOrderEmailTemplatePage />,
      },
      {
        key: "order-pdf-designer",
        icon: <DesignServicesIcon />,
        label: "Bestell-PDF Designer",
        content: <PurchaseOrderTemplatePage />,
      },
      {
        key: "qr-template",
        icon: <QrCode2Icon />,
        label: "QR-Wagenkatalog Vorlage",
        content: <PdfTemplateBuilderPage />,
      },
      ...(canManageInventoryTemplate
        ? [
            {
              key: "inventory-template",
              icon: <TableChartIcon />,
              label: "Inventur-Vorlage",
              content: <InventoryTemplateSettingsPage />,
            },
          ]
        : []),
    ],
    [canManageInventoryTemplate],
  );

  useEffect(() => {
    if (tabValue >= tabs.length) {
      setTabValue(0);
    }
  }, [tabValue, tabs.length]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get("tab");
    if (!requestedTab) {
      return;
    }
    const requestedIndex = tabs.findIndex((tab) => tab.key === requestedTab);
    if (requestedIndex >= 0) {
      setTabValue(requestedIndex);
    }
  }, [location.search, tabs]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Lagereinstellungen
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          {tabs.map((tab) => (
            <Tab key={tab.key} icon={tab.icon} iconPosition="start" label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {tabs.map((tab, index) => (
        <TabPanel key={tab.key} value={tabValue} index={index}>
          {tab.content}
        </TabPanel>
      ))}
    </Box>
  );
};

export default WarehouseSettingsPage;
