import React, { useState } from "react";
import { Box, Paper, Tab, Tabs, Typography, alpha, useTheme } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ArchiveIcon from "@mui/icons-material/Archive";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

import OrderSuggestionsTab from "../components/orders/OrderSuggestionsTab";
import ActiveOrdersTab from "../components/orders/ActiveOrdersTab";
import ArchivedOrdersTab from "../components/orders/ArchivedOrdersTab";
import GoodsReceiptTab from "../components/orders/GoodsReceiptTab";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2.5 }}>{children}</Box>}
    </div>
  );
};

const OrdersPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          mb: 2,
          borderRadius: 3,
          background: `linear-gradient(130deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.secondary.main, 0.14)} 100%)`,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, fontFamily: '"Sora", "Manrope", sans-serif' }}>
          Bestellungen
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Bestellverwaltung mit Sortierung nach Jahr und Lieferant.
        </Typography>
      </Paper>

      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
          <Tabs
            value={tabValue}
            onChange={(_, value) => setTabValue(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab icon={<ShoppingCartIcon />} iconPosition="start" label="Vorschläge" />
            <Tab icon={<PendingActionsIcon />} iconPosition="start" label="Offen" />
            <Tab icon={<LocalShippingIcon />} iconPosition="start" label="Wareneingang" />
            <Tab icon={<ArchiveIcon />} iconPosition="start" label="Archiv" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 1.25, md: 2 } }}>
          <TabPanel value={tabValue} index={0}>
            <OrderSuggestionsTab />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <ActiveOrdersTab />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <GoodsReceiptTab />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <ArchivedOrdersTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default OrdersPage;
