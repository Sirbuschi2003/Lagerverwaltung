import React, { useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useLocation } from 'react-router-dom';
import useTabStore from '../store/useTabStore';
import { ROUTE_CONFIG_MAP } from './routeConfig';

const TabBar: React.FC = () => {
  const { tabs, closeTab } = useTabStore();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Aktiven Tab bei Pfadwechsel in den sichtbaren Bereich scrollen
  useEffect(() => {
    const activePath = location.pathname === '/' ? '/dashboard' : location.pathname;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-path="${activePath}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [location.pathname]);

  if (tabs.length === 0) return null;

  const activePath = location.pathname === '/' ? '/dashboard' : location.pathname;

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const tabIndex = tabs.findIndex((t) => t.path === path);
    closeTab(path);
    if (activePath === path) {
      const remaining = tabs.filter((t) => t.path !== path);
      if (remaining.length > 0) {
        const nextTab = remaining[Math.min(tabIndex, remaining.length - 1)];
        navigate(nextTab.path);
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    // Nur auf Desktop sichtbar (md+)
    <Box
      ref={scrollRef}
      sx={{
        display: { xs: 'none', md: 'flex' },
        overflowX: 'auto',
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        mb: 1,
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
      }}
    >
      {tabs.map((tab) => {
        const config = ROUTE_CONFIG_MAP[tab.path];
        const Icon = config?.Icon;
        const isActive = activePath === tab.path;

        return (
          <Tooltip key={tab.path} title={tab.label} disableHoverListener={tab.label.length < 20}>
            <Box
              data-path={tab.path}
              onClick={() => navigate(tab.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                borderRight: '1px solid',
                borderColor: 'divider',
                borderBottom: isActive ? '2px solid' : '2px solid transparent',
                borderBottomColor: isActive ? 'primary.main' : 'transparent',
                bgcolor: isActive ? 'action.selected' : 'transparent',
                color: isActive ? 'primary.main' : 'text.secondary',
                fontSize: '0.78rem',
                fontWeight: isActive ? 600 : 400,
                transition: 'background-color 0.15s, color 0.15s',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: isActive ? 'primary.main' : 'text.primary',
                },
              }}
            >
              {Icon && <Icon sx={{ fontSize: 15 }} />}
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tab.label}
              </span>
              <IconButton
                size="small"
                onClick={(e) => handleClose(e, tab.path)}
                sx={{
                  p: 0.15,
                  ml: 0.25,
                  color: 'inherit',
                  opacity: 0.6,
                  '&:hover': { opacity: 1, color: 'error.main', bgcolor: 'transparent' },
                }}
              >
                <CloseIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default TabBar;
