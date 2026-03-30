import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Link,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Email } from '@mui/icons-material';
import { passwordResetApi } from '../utils/passwordResetApi';

interface PasswordResetPageProps {
  onBackToLogin: () => void;
}

const PasswordResetPage: React.FC<PasswordResetPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'request' | 'sent'>('request');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await passwordResetApi.requestPasswordReset(email);
      setMessage(result.message);
      setStep('sent');
    } catch (err: any) {
      setError(err.message || 'Netzwerkfehler - Bitte versuchen Sie es später erneut');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'sent') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
        <Paper sx={{ p: 4, width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <Email sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>
            E-Mail gesendet
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            {message}
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Überprüfen Sie Ihren E-Mail-Posteingang und folgen Sie den Anweisungen zum
            Zurücksetzen Ihres Passworts. Die E-Mail kann einige Minuten brauchen.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={onBackToLogin}
              fullWidth
            >
              Zurück zur Anmeldung
            </Button>
            <Button
              variant="contained"
              onClick={() => setStep('request')}
              fullWidth
            >
              Erneut senden
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Passwort zurücksetzen
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen
          Ihres Passworts.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="E-Mail-Adresse"
          type="email"
          fullWidth
          required
          margin="normal"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{ mt: 3, mb: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Reset-E-Mail senden'}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToLogin}
            sx={{ textDecoration: 'none' }}
          >
            <ArrowBack sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Zurück zur Anmeldung
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};

export default PasswordResetPage;