/**
 * ModernCard Component
 * Hochwertige, responsive Card mit konsistenter Styling
 */

import React, { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Box,
  useTheme,
  alpha,
} from '@mui/material';
import { designTokens } from '../styles/designTokens';

interface ModernCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  sx?: any;
  variant?: 'elevated' | 'outlined' | 'flat';
  interactive?: boolean;
  onClick?: () => void;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  title,
  subtitle,
  children,
  actions,
  icon,
  sx,
  variant = 'elevated',
  interactive = false,
  onClick,
}) => {
  const theme = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return {
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none',
        };
      case 'flat':
        return {
          boxShadow: 'none',
          backgroundColor: alpha(theme.palette.primary.main, 0.03),
        };
      default:
        return {
          boxShadow: designTokens.shadows.md,
        };
    }
  };

  return (
    <Card
      sx={{
        borderRadius: designTokens.borderRadius.lg,
        transition: `all ${designTokens.transitions.normal}`,
        cursor: interactive ? 'pointer' : 'default',
        '&:hover': interactive
          ? {
              boxShadow: designTokens.shadows.lg,
              transform: 'translateY(-2px)',
            }
          : undefined,
        ...getVariantStyles(),
        ...sx,
      }}
      onClick={onClick}
    >
      {(title || icon) && (
        <CardHeader
          avatar={icon}
          title={title}
          subheader={subtitle}
          sx={{
            paddingBottom: subtitle ? designTokens.spacing.md : designTokens.spacing.sm,
          }}
        />
      )}
      <CardContent sx={{ '&:last-child': { pb: designTokens.spacing.md } }}>
        {children}
      </CardContent>
      {actions && (
        <CardActions sx={{ pt: 0 }}>
          {actions}
        </CardActions>
      )}
    </Card>
  );
};

/**
 * StatsCard Component
 * Spezielle Card für Statistiken/KPIs
 */
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  color = 'primary',
}) => {
  const theme = useTheme();

  return (
    <ModernCard variant="flat" sx={{ textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: '50%',
            backgroundColor: alpha(theme.palette[color].main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette[color].main,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Box sx={{ typography: 'h4', fontWeight: 600, mb: 0.5 }}>
        {value}
      </Box>
      <Box sx={{ typography: 'body2', color: 'text.secondary', mb: trend ? 1 : 0 }}>
        {label}
      </Box>
      {trend && trendValue && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            typography: 'caption',
            color: trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary',
            fontWeight: 500,
          }}
        >
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendValue}
        </Box>
      )}
    </ModernCard>
  );
};

export default ModernCard;
