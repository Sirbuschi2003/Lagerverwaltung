// Password Reset API functions
import { SecureTokenManager } from "./securityUtils";

export interface RequestPasswordResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ApiResponse {
  message: string;
}

export const passwordResetApi = {
  async requestPasswordReset(email: string): Promise<ApiResponse> {
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Senden der E-Mail');
    }
    
    return result;
  },

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Zurücksetzen des Passworts');
    }
    
    return result;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    const token = SecureTokenManager.getToken();

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Fehler beim Ändern des Passworts');
    }
    
    return result;
  },
};