import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Business as BusinessIcon } from "@mui/icons-material";
import { APP_VERSION } from "../utils/version";
import useAuthStore from "../store/useAuthStore";
import useSystemConfigStore from "../store/useSystemConfigStore";

const SettingsPage = () => {
  const user = useAuthStore((state: any) => state.user);
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const isManager = hasPermission("settings.company");
  const {
    companyName,
    companyLogo,
    companyAddressLine1,
    companyAddressLine2,
    companyPostalCode,
    companyCity,
    companyCountry,
    companyPhone,
    companyEmail,
    hasLoaded: companyLoaded,
    isLoading: companyLoading,
    loadCompany,
    saveCompany,
  } = useSystemConfigStore((state) => ({
    companyName: state.companyName,
    companyLogo: state.companyLogo,
    companyAddressLine1: state.companyAddressLine1,
    companyAddressLine2: state.companyAddressLine2,
    companyPostalCode: state.companyPostalCode,
    companyCity: state.companyCity,
    companyCountry: state.companyCountry,
    companyPhone: state.companyPhone,
    companyEmail: state.companyEmail,
    hasLoaded: state.hasLoaded,
    isLoading: state.isLoading,
    loadCompany: state.loadCompany,
    saveCompany: state.saveCompany,
  }));

  const [companyNameInput, setCompanyNameInput] = useState<string>("");
  const [companyAddressLine1Input, setCompanyAddressLine1Input] = useState<string>("");
  const [companyAddressLine2Input, setCompanyAddressLine2Input] = useState<string>("");
  const [companyPostalCodeInput, setCompanyPostalCodeInput] = useState<string>("");
  const [companyCityInput, setCompanyCityInput] = useState<string>("");
  const [companyCountryInput, setCompanyCountryInput] = useState<string>("");
  const [companyPhoneInput, setCompanyPhoneInput] = useState<string>("");
  const [companyEmailInput, setCompanyEmailInput] = useState<string>("");
  const [appLogoPreview, setAppLogoPreview] = useState<string | null>(null);
  const [appLogoRemove, setAppLogoRemove] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [companySaving, setCompanySaving] = useState(false);

  useEffect(() => {
    if (!companyLoaded) {
      loadCompany().catch(() => undefined);
    }
  }, [companyLoaded, loadCompany]);


  useEffect(() => {
    setCompanyNameInput(companyName ?? "");
    setAppLogoPreview(companyLogo ?? null);
    setCompanyAddressLine1Input(companyAddressLine1 ?? "");
    setCompanyAddressLine2Input(companyAddressLine2 ?? "");
    setCompanyPostalCodeInput(companyPostalCode ?? "");
    setCompanyCityInput(companyCity ?? "");
    setCompanyCountryInput(companyCountry ?? "");
    setCompanyPhoneInput(companyPhone ?? "");
    setCompanyEmailInput(companyEmail ?? "");
    setAppLogoRemove(false);
  }, [
    companyName,
    companyLogo,
    companyAddressLine1,
    companyAddressLine2,
    companyPostalCode,
    companyCity,
    companyCountry,
    companyPhone,
    companyEmail,
  ]);

  const cleanField = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAppLogoPreview(reader.result);
        setAppLogoRemove(false);
        setCompanyMessage(null);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveLogo = () => {
    setAppLogoPreview(null);
    setAppLogoRemove(true);
    setCompanyMessage(null);
  };

  const handleSaveCompany = async () => {
    if (!companyNameInput.trim()) {
      setCompanyMessage({ type: "error", text: "Bitte einen Firmennamen eingeben." });
      return;
    }

    setCompanySaving(true);
    setCompanyMessage(null);
    try {
      await saveCompany({
        name: companyNameInput.trim(),
        logoDataUrl: appLogoRemove ? undefined : appLogoPreview || undefined,
        removeLogo: appLogoRemove,
        addressLine1: cleanField(companyAddressLine1Input),
        addressLine2: cleanField(companyAddressLine2Input),
        postalCode: cleanField(companyPostalCodeInput),
        city: cleanField(companyCityInput),
        country: cleanField(companyCountryInput),
        phone: cleanField(companyPhoneInput),
        email: cleanField(companyEmailInput),
      });
      setCompanyMessage({ type: "success", text: "Firmendaten wurden gespeichert." });
    } catch (error) {
      console.error("Fehler beim Speichern der Firmendaten:", error);
      setCompanyMessage({ type: "error", text: "Speichern der Firmendaten fehlgeschlagen." });
    } finally {
      setCompanySaving(false);
    }
  };



  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">Firmendaten</Typography>
        <Chip label={`Version ${APP_VERSION} (Dev)`} size="small" color="warning" variant="outlined" />
      </Box>

      {isManager && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <BusinessIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Firmendaten & App-Logo</Typography>
          </Box>

          {companyMessage && (
            <Alert severity={companyMessage.type} sx={{ mb: 2 }}>
              {companyMessage.text}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Firmenname"
                value={companyNameInput}
                onChange={(e) => setCompanyNameInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Adresse"
                value={companyAddressLine1Input}
                onChange={(e) => setCompanyAddressLine1Input(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Adresse (2)"
                value={companyAddressLine2Input}
                onChange={(e) => setCompanyAddressLine2Input(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="PLZ"
                value={companyPostalCodeInput}
                onChange={(e) => setCompanyPostalCodeInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Ort"
                value={companyCityInput}
                onChange={(e) => setCompanyCityInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Land"
                value={companyCountryInput}
                onChange={(e) => setCompanyCountryInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Telefon"
                value={companyPhoneInput}
                onChange={(e) => setCompanyPhoneInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="E-Mail"
                value={companyEmailInput}
                onChange={(e) => setCompanyEmailInput(e.target.value)}
                disabled={companyLoading}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                App-Logo (wird auch als PWA/Icon genutzt)
              </Typography>
              {appLogoPreview && !appLogoRemove && (
                <Box sx={{ mb: 2 }}>
                  <Box
                    component="img"
                    src={appLogoPreview}
                    alt="App-Logo Vorschau"
                    sx={{ maxHeight: 100, maxWidth: 300, objectFit: "contain" }}
                  />
                  <Button size="small" color="error" onClick={handleRemoveLogo} sx={{ ml: 2 }}>
                    Logo entfernen
                  </Button>
                </Box>
              )}
              <Button variant="outlined" component="label" disabled={companyLoading}>
                {appLogoPreview && !appLogoRemove ? "Logo ändern" : "Logo hochladen"}
                <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Empfohlen: quadratisches PNG (z. B. 512x512), wird als App-Icon genutzt.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={handleSaveCompany}
                disabled={companySaving || companyLoading || !companyLoaded}
              >
                {companySaving ? "Speichert..." : "Firmendaten speichern"}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {!isManager && (companyName || appLogoPreview) && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Firmendaten
          </Typography>
          {appLogoPreview && (
            <Box
              component="img"
              src={appLogoPreview}
              alt={companyName || "Firmenlogo"}
              sx={{ maxHeight: 70, maxWidth: 200, objectFit: "contain", mb: companyName ? 2 : 0 }}
            />
          )}
          {companyName && (
            <Typography variant="body1" fontWeight={600}>
              {companyName}
            </Typography>
          )}
          {companyAddressLine1 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {companyAddressLine1}
            </Typography>
          )}
          {companyAddressLine2 && (
            <Typography variant="body2">{companyAddressLine2}</Typography>
          )}
          {(companyPostalCode || companyCity) && (
            <Typography variant="body2">
              {[companyPostalCode, companyCity].filter(Boolean).join(" ")}
            </Typography>
          )}
          {companyCountry && <Typography variant="body2">{companyCountry}</Typography>}
          {companyPhone && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Telefon: {companyPhone}
            </Typography>
          )}
          {companyEmail && <Typography variant="body2">E-Mail: {companyEmail}</Typography>}
        </Paper>
      )}
    </Container>
  );
};

export default SettingsPage;
