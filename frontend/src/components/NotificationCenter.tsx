import React, { useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Notifications as BellIcon,
  NotificationsNone as BellEmptyIcon,
  CheckCircleOutline as CheckAllIcon,
  DeleteSweep as ClearIcon,
  BuildCircle as RestockIcon,
  Warning as LowStockIcon,
  LocalShipping as OrderIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import useNotificationStore, { AppNotification, NotificationType } from "../store/useNotificationStore";

const TYPE_META: Record<NotificationType, { icon: React.ReactElement; color: string }> = {
  RESTOCK_APPROVED: { icon: <RestockIcon fontSize="small" />, color: "success.main" },
  STOCK_LOW: { icon: <LowStockIcon fontSize="small" />, color: "warning.main" },
  ORDER_RECEIVED: { icon: <OrderIcon fontSize="small" />, color: "info.main" },
  INFO: { icon: <InfoIcon fontSize="small" />, color: "text.secondary" },
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
};

const NotificationItem: React.FC<{ notification: AppNotification; onClose: () => void }> = ({
  notification,
  onClose,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { markRead } = useNotificationStore();
  const meta = TYPE_META[notification.type];

  const handleClick = () => {
    markRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
    onClose();
  };

  return (
    <ListItem disablePadding divider>
      <ListItemButton
        onClick={handleClick}
        sx={{
          py: 1.25,
          px: 2,
          bgcolor: notification.read
            ? undefined
            : alpha(theme.palette.primary.main, 0.07),
          "&:hover": {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
          },
        }}
      >
        <Box sx={{ color: meta.color, mr: 1.5, display: "flex", alignItems: "flex-start", mt: 0.25 }}>
          {meta.icon}
        </Box>
        <ListItemText
          primary={
            <Typography
              variant="body2"
              sx={{ fontWeight: notification.read ? 500 : 700, lineHeight: 1.4 }}
            >
              {notification.title}
            </Typography>
          }
          secondary={
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {notification.message}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.25 }}>
                {formatRelative(notification.timestamp)}
              </Typography>
            </Box>
          }
          disableTypography
        />
        {!notification.read && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.main",
              flexShrink: 0,
              ml: 1,
              mt: 0.5,
            }}
          />
        )}
      </ListItemButton>
    </ListItem>
  );
};

const NotificationCenter: React.FC = () => {
  const theme = useTheme();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const { notifications, unreadCount, markAllRead, clearAll } = useNotificationStore();

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Tooltip title="Benachrichtigungen">
        <IconButton
          ref={anchorRef}
          onClick={handleOpen}
          size="small"
          aria-label="Benachrichtigungen"
        >
          <Badge
            badgeContent={unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined}
            color="error"
            sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16 } }}
          >
            {unreadCount > 0 ? (
              <BellIcon sx={{ color: theme.palette.primary.main }} />
            ) : (
              <BellEmptyIcon sx={{ color: theme.palette.text.secondary }} />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: 520,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              mt: 0.5,
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Benachrichtigungen
            {unreadCount > 0 && (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  ml: 1,
                  px: 0.75,
                  py: 0.25,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  borderRadius: 99,
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </Typography>
            )}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Alle als gelesen markieren">
                <IconButton size="small" onClick={markAllRead}>
                  <CheckAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip title="Alle löschen">
                <IconButton size="small" onClick={clearAll} sx={{ color: "error.main" }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Liste */}
        {notifications.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center", color: "text.secondary" }}>
            <BellEmptyIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
            <Typography variant="body2">Keine Benachrichtigungen</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflowY: "auto", flex: 1 }}>
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onClose={handleClose} />
            ))}
          </List>
        )}
      </Popover>
    </>
  );
};

export default NotificationCenter;
