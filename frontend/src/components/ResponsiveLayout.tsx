import React from 'react';
import { 
  useTheme, 
  useMediaQuery, 
  Box, 
  Drawer, 
  IconButton,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useNavigate, useLocation } from 'react-router-dom';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  navigationOpen: boolean;
  onNavigationToggle: () => void;
}

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/vehicle', label: 'Mein Fahrzeug', icon: <DirectionsCarIcon /> },
  { path: '/fleet', label: 'Fahrzeugbestände', icon: <DirectionsCarIcon /> },
  { path: '/inventory', label: 'Lager', icon: <InventoryIcon /> },
];

export default function ResponsiveLayout({ 
  children, 
  navigationOpen, 
  onNavigationToggle 
}: ResponsiveLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const drawerWidth = 280;

  const drawerContent = (
    <Box sx={{ width: drawerWidth, height: '100%' }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 2,
        minHeight: 64
      }}>
        <Typography variant="h6" component="div">
          Lagerverwaltung
        </Typography>
        {isMobile && (
          <IconButton onClick={onNavigationToggle} edge="end">
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      
      <Divider />
      
      <List>
        {navigationItems.map((item) => (
          <ListItem
            button
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) {
                onNavigationToggle();
              }
            }}
            sx={{
              '&.Mui-selected': {
                backgroundColor: theme.palette.primary.main + '20',
                '&:hover': {
                  backgroundColor: theme.palette.primary.main + '30',
                },
              },
            }}
          >
            <ListItemIcon sx={{ 
              color: location.pathname === item.path 
                ? theme.palette.primary.main 
                : 'inherit' 
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label}
              sx={{
                '& .MuiListItemText-primary': {
                  color: location.pathname === item.path 
                    ? theme.palette.primary.main 
                    : 'inherit',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                }
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Navigation */}
      {!isMobile && (
        <Drawer
          variant="persistent"
          anchor="left"
          open={navigationOpen}
          sx={{
            width: navigationOpen ? drawerWidth : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Navigation */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={navigationOpen}
          onClose={onNavigationToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile ? '100%' : `calc(100% - ${navigationOpen ? drawerWidth : 0}px)`,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(navigationOpen && !isMobile && {
            marginLeft: 0,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
