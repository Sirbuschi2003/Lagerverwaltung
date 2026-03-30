import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, Lock } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { passwordResetApi } from '../utils/passwordResetApi';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Ungültiger Reset-Link');
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!token) {
      setError('Ungültiger Reset-Link');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await passwordResetApi.resetPassword(token, newPassword);
      setMessage(result.message);
      setSuccess(true);
      // Nach 3 Sekunden zur Login-Seite weiterleiten
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Netzwerkfehler - Bitte versuchen Sie es später erneut');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
        <Paper sx={{ p: 4, width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>
            Passwort erfolgreich zurückgesetzt
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            {message}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sie werden in Kürze zur Anmeldung weitergeleitet...
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!token) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
        <Paper sx={{ p: 4, width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ mb: 2, color: 'error.main' }}>
            Ungültiger Reset-Link
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            Der Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/login')}
            fullWidth
          >
            Zur Anmeldung
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5">
            Neues Passwort setzen
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Geben Sie Ihr neues Passwort ein
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Neues Passwort"
          type="password"
          fullWidth
          required
          margin="normal"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={loading}
          helperText="Mindestens 8 Zeichen"
        />

        <TextField
          label="Passwort bestätigen"
          type="password"
          fullWidth
          required
          margin="normal"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={loading}
          error={confirmPassword !== '' && newPassword !== confirmPassword}
          helperText={
            confirmPassword !== '' && newPassword !== confirmPassword
              ? 'Passwörter stimmen nicht überein'
              : ''
          }
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading || newPassword !== confirmPassword || newPassword.length < 8}
          sx={{ mt: 3, mb: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Passwort zurücksetzen'}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="text"
            onClick={() => navigate('/login')}
            disabled={loading}
            size="small"
          >
            Zur Anmeldung
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResetPasswordPage;