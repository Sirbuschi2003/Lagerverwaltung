/**
 * Modern Form Components
 * Konsistent gestaltete Formular-Elemente mit Validierung
 */

import React, { useState } from 'react';
import {
  TextField,
  TextFieldProps,
  Box,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { designTokens } from '../styles/designTokens';
import { validatePasswordStrength } from '../utils/securityUtils';

interface ModernInputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
}

export const ModernInput: React.FC<ModernInputProps> = (props) => {
  const theme = useTheme();

  return (
    <TextField
      {...props}
      variant="outlined"
      fullWidth
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: designTokens.borderRadius.md,
          transition: designTokens.transitions.fast,
          backgroundColor: alpha(theme.palette.background.paper, 0.5),
          '&:hover': {
            backgroundColor: theme.palette.background.paper,
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
          },
        },
        ...props.sx,
      }}
    />
  );
};

/**
 * Password Input mit Visibility Toggle
 */
interface PasswordInputProps extends Omit<ModernInputProps, 'type'> {
  showStrength?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  showStrength = true,
  value,
  ...props
}) => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    strength: 'weak' | 'medium' | 'strong';
  }>({
    score: 0,
    strength: 'weak',
  });

  React.useEffect(() => {
    if (showStrength && typeof value === 'string') {
      const result = validatePasswordStrength(value);
      setPasswordStrength({
        score: result.score,
        strength: result.strength,
      });
    }
  }, [value, showStrength]);

  const getStrengthColor = () => {
    switch (passwordStrength.strength) {
      case 'strong':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'error';
    }
  };

  const getStrengthLabel = () => {
    switch (passwordStrength.strength) {
      case 'strong':
        return 'Starkes Passwort';
      case 'medium':
        return 'Mittleres Passwort';
      default:
        return 'Schwaches Passwort';
    }
  };

  return (
    <Box>
      <ModernInput
        {...props}
        type={showPassword ? 'text' : 'password'}
        value={value}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={showPassword ? 'Verbergen' : 'Anzeigen'}>
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                  tabIndex={-1}
                >
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
          ...props.InputProps,
        }}
      />
      {showStrength && typeof value === 'string' && value.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Passwortsstärke
            </Typography>
            <Typography
              variant="caption"
              color={theme.palette[getStrengthColor()].main}
              fontWeight={500}
            >
              {getStrengthLabel()}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={passwordStrength.score}
            sx={{
              height: 4,
              borderRadius: designTokens.borderRadius.sm,
              backgroundColor: alpha(theme.palette.divider, 0.5),
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette[getStrengthColor()].main,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

/**
 * Email Input mit Validierung
 */
export const EmailInput: React.FC<ModernInputProps> = (props) => {
  const theme = useTheme();
  const [isValid, setIsValid] = React.useState<boolean | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValid(value.length === 0 ? null : emailRegex.test(value));
    props.onChange?.(e);
  };

  return (
    <ModernInput
      {...props}
      type="email"
      onChange={handleChange}
      InputProps={{
        endAdornment: isValid !== null && (
          <InputAdornment position="end">
            {isValid ? (
              <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
            ) : (
              <ErrorIcon sx={{ color: theme.palette.error.main }} />
            )}
          </InputAdornment>
        ),
        ...props.InputProps,
      }}
      helperText={isValid === false ? 'Ungültige E-Mail-Adresse' : props.helperText}
      error={isValid === false || props.error}
    />
  );
};

export default ModernInput;
