/**
 * Modern Button Components
 * Konsistent gestaltete Buttons mit verschiedenen Varianten
 */

import React from 'react';
import {
  Button,
  ButtonProps,
  CircularProgress,
  Box,
  useTheme,
} from '@mui/material';
import { designTokens } from '../styles/designTokens';

interface ModernButtonProps extends ButtonProps {
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  loading = false,
  icon,
  iconPosition = 'start',
  children,
  disabled,
  ...props
}) => {
  const theme = useTheme();

  return (
    <Button
      {...props}
      disabled={disabled || loading}
      sx={{
        textTransform: 'none',
        fontWeight: 500,
        borderRadius: designTokens.borderRadius.md,
        transition: designTokens.transitions.normal,
        fontSize: designTokens.typography.button.fontSize,
        ...props.sx,
      }}
      startIcon={iconPosition === 'start' && !loading ? icon : undefined}
      endIcon={iconPosition === 'end' && !loading ? icon : undefined}
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} color="inherit" />
          {children}
        </Box>
      ) : (
        children
      )}
    </Button>
  );
};

/**
 * Primary Action Button (Contained)
 */
export const PrimaryButton: React.FC<ModernButtonProps> = (props) => (
  <ModernButton variant="contained" color="primary" {...props} />
);

/**
 * Secondary Action Button (Outlined)
 */
export const SecondaryButton: React.FC<ModernButtonProps> = (props) => (
  <ModernButton variant="outlined" color="primary" {...props} />
);

/**
 * Danger Action Button (Delete/Remove)
 */
export const DangerButton: React.FC<ModernButtonProps> = (props) => (
  <ModernButton variant="contained" color="error" {...props} />
);

/**
 * Success Button
 */
export const SuccessButton: React.FC<ModernButtonProps> = (props) => (
  <ModernButton
    variant="contained"
    sx={{
      backgroundColor: (theme) => theme.palette.success.main,
      '&:hover': {
        backgroundColor: (theme) => theme.palette.success.dark,
      },
    }}
    {...props}
  />
);

export default ModernButton;
