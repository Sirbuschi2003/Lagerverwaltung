import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import useSetupStore from "../store/useSetupStore";

const SetupPage = () => {
  const navigate = useNavigate();
  const { needsSetup, completeSetup, checkStatus, isLoading } = useSetupStore();
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (needsSetup === null) {
      checkStatus();
    }
  }, [needsSetup, checkStatus]);

  useEffect(() => {
    if (needsSetup === false) {
      navigate("/login", { replace: true });
    }
  }, [needsSetup, navigate]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.username.trim()) return "Bitte Benutzernamen eingeben.";
    if (!form.displayName.trim()) return "Bitte Anzeigenamen eingeben.";
    if (form.password.length < 6) return "Passwort muss mindestens 6 Zeichen haben.";
    if (form.password !== form.confirmPassword) return "Passwörter stimmen nicht überein.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await completeSetup({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
      });
      navigate("/login", { replace: true });
    } catch (submitError) {
      console.error(submitError);
      setError("Setup konnte nicht abgeschlossen werden. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || needsSetup === null) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Card sx={{ maxWidth: 420, width: "100%", backgroundColor: "background.paper" }}>
        <CardContent component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Erstkonfiguration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Bitte lege einen Administrator-Zugang an. Danach kannst du dich mit
            diesen Daten anmelden und weitere Benutzer erstellen.
          </Typography>
          <TextField
            label="Benutzername"
            name="username"
            value={form.username}
            onChange={handleChange}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Anzeigename"
            name="displayName"
            value={form.displayName}
            onChange={handleChange}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Passwort"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Passwort bestätigen"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
          >
            Setup abschließen
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SetupPage;
