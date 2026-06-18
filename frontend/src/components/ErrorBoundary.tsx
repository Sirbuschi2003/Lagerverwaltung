import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Typography,
  Paper,
  Container
} from '@mui/material';
import { Refresh, Home, BugReport, WifiOff } from '@mui/icons-material';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log error to security logger if available
    if (typeof window !== 'undefined' && (window as any).SecurityLogger) {
      (window as any).SecurityLogger.logSecurityEvent('react_error_boundary', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  private isChunkLoadError(error?: Error): boolean {
    if (!error) return false;
    return (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError'
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private clearError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.isChunkLoadError(this.state.error)) {
        return (
          <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <WifiOff color="warning" sx={{ fontSize: 56 }} />
                <Typography variant="h5" component="h1">
                  Seite nicht verfügbar
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Diese Seite konnte nicht geladen werden, weil die App außerhalb des
                  Firmennetzwerks ist oder keine Verbindung besteht.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Offlinefunktionen (Ausbuchen, Sync) sind weiterhin nutzbar.
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center" sx={{ mt: 1 }}>
                  <Button variant="contained" startIcon={<Refresh />} onClick={this.handleReload}>
                    Erneut versuchen
                  </Button>
                  <Button variant="outlined" startIcon={<Home />} onClick={this.handleGoHome}>
                    Zur Startseite
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Container>
        );
      }

      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
              <BugReport color="error" sx={{ fontSize: 64 }} />
              
              <Typography variant="h4" component="h1" gutterBottom>
                Oops! Etwas ist schiefgelaufen
              </Typography>
              
              <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
                <AlertTitle>JavaScript-Fehler erkannt</AlertTitle>
                <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                  <strong>Fehler:</strong> {this.state.error?.message || 'Unbekannter Fehler'}
                </Typography>
                
                {this.state.error?.stack && (
                  <Box 
                    component="pre" 
                    sx={{ 
                      mt: 2, 
                      p: 2, 
                      bgcolor: 'grey.100', 
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}
                  >
                    {this.state.error.stack.split('\n').slice(0, 10).join('\n')}
                  </Box>
                )}
              </Alert>

              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '600px' }}>
                Ein unerwarteter Fehler ist aufgetreten. Dies kann durch eine fehlerhafte 
                Komponente oder ein Problem mit den geladenen Daten verursacht werden.
              </Typography>

              <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleReload}
                  size="large"
                >
                  Seite neu laden
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Home />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Zur Startseite
                </Button>
                
                <Button
                  variant="text"
                  onClick={this.clearError}
                  size="large"
                >
                  Erneut versuchen
                </Button>
              </Box>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Box sx={{ mt: 3, width: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Component Stack (Development):
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'grey.50', 
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: '200px',
                      textAlign: 'left'
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;