import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { LoggingService } from '../logging/services/logging.service';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Default sender address
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService {
  /** Cache pro Niederlassung: key = branchId oder 'global' */
  private transporters: Map<string, nodemailer.Transporter> = new Map();

  constructor(private readonly loggingService: LoggingService) {}

  /**
   * Konfiguriert den Email-Transport (global oder niederlassungsspezifisch).
   * Super-Admin (branchId = null) → schreibt in system_config (gilt als Fallback für alle).
   * Branch-Manager → schreibt in branch_configs (eigene Einstellungen).
   */
  async configureTransport(config: EmailConfig, branchId?: string | null): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
      });

      if (transporter) {
        await transporter.verify();
      }

      const cacheKey = branchId || 'global';
      this.transporters.set(cacheKey, transporter);

      await this.loggingService.setConfig('email.host', config.host, 'SMTP Server Host', false, branchId ?? undefined);
      await this.loggingService.setConfig('email.port', config.port.toString(), 'SMTP Server Port', false, branchId ?? undefined);
      await this.loggingService.setConfig('email.secure', config.secure.toString(), 'SMTP TLS/SSL', false, branchId ?? undefined);
      await this.loggingService.setConfig('email.user', config.auth.user, 'SMTP Benutzername', false, branchId ?? undefined);
      await this.loggingService.setConfig('email.password', config.auth.pass, 'SMTP Passwort', true, branchId ?? undefined);
      await this.loggingService.setConfig('email.from', config.from, 'Standard Absender-Adresse', false, branchId ?? undefined);

      await this.loggingService.logInfo(
        'SYSTEM' as any,
        'EMAIL_CONFIG_UPDATED',
        `Email-Konfiguration aktualisiert: ${config.host}:${config.port}${branchId ? ` (Niederlassung: ${branchId})` : ' (global)'}`,
        { metadata: { host: config.host, port: config.port, secure: config.secure, user: config.auth.user, branchId } },
      );
    } catch (error) {
      await this.loggingService.logError(
        'SYSTEM' as any,
        'EMAIL_CONFIG_FAILED',
        `Email-Konfiguration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        { metadata: { error: error instanceof Error ? error.message : 'Unbekannter Fehler' } },
      );
      throw error;
    }
  }

  /**
   * Lädt die Email-Konfiguration aus der Datenbank (branch-spezifisch mit globalem Fallback).
   */
  async loadConfiguration(branchId?: string | null): Promise<void> {
    const host = await this.loggingService.getConfig('email.host', branchId ?? undefined);
    const port = await this.loggingService.getConfig('email.port', branchId ?? undefined);
    const secure = await this.loggingService.getConfig('email.secure', branchId ?? undefined);
    const user = await this.loggingService.getConfig('email.user', branchId ?? undefined);
    const password = await this.loggingService.getConfig('email.password', branchId ?? undefined);
    const from = await this.loggingService.getConfig('email.from', branchId ?? undefined);

    if (host && port && user && password && from) {
      const cacheKey = branchId || 'global';
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure === 'true',
        auth: { user, pass: password },
      });
      this.transporters.set(cacheKey, transporter);
    }
  }

  /**
   * Gibt den Transporter für die angegebene Niederlassung zurück.
   * Versucht zuerst branch-spezifisch, dann global.
   */
  private async getTransporter(branchId?: string | null): Promise<nodemailer.Transporter> {
    const cacheKey = branchId || 'global';

    if (this.transporters.has(cacheKey)) {
      return this.transporters.get(cacheKey)!;
    }

    // Versuche zu laden
    await this.loadConfiguration(branchId);

    if (this.transporters.has(cacheKey)) {
      return this.transporters.get(cacheKey)!;
    }

    // Fallback auf global wenn branchId gesetzt aber keine eigene Config
    if (branchId && !this.transporters.has(cacheKey)) {
      if (this.transporters.has('global')) return this.transporters.get('global')!;
      await this.loadConfiguration(null);
      if (this.transporters.has('global')) return this.transporters.get('global')!;
    }

    throw new Error('Email-Service nicht konfiguriert');
  }

  /**
   * Sendet eine Email
   */
  async sendEmail(options: SendEmailOptions, branchId?: string | null): Promise<void> {
    const transporter = await this.getTransporter(branchId);

    try {
      const defaultFrom = await this.loggingService.getConfig('email.from', branchId ?? undefined);

      const mailOptions = {
        from: options.from || defaultFrom || '',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const info = await transporter.sendMail(mailOptions) as { messageId?: string };

      await this.loggingService.logInfo(
        'SYSTEM' as any,
        'EMAIL_SENT',
        `Email gesendet: "${options.subject}" an ${mailOptions.to}`,
        { metadata: { to: mailOptions.to, subject: options.subject, messageId: info.messageId || 'unknown' } },
      );
    } catch (error) {
      await this.loggingService.logError(
        'SYSTEM' as any,
        'EMAIL_SEND_FAILED',
        `Email-Versand fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        { metadata: { to: options.to, subject: options.subject, error: error instanceof Error ? error.message : 'Unbekannter Fehler' } },
      );
      throw error;
    }
  }

  /**
   * Test-Email senden
   */
  async sendTestEmail(to: string, branchId?: string | null): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'KFZ Teilelager - Test Email',
      html: `
        <h2>Email-Test erfolgreich</h2>
        <p>Diese Test-Email wurde erfolgreich vom KFZ Teilelager System gesendet.</p>
        <p><strong>Zeitstempel:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <hr>
        <p><small>KFZ Teilelager System</small></p>
      `,
      text: `Email-Test erfolgreich\n\nZeitstempel: ${new Date().toLocaleString('de-DE')}\n\nKFZ Teilelager System`,
    }, branchId);
  }

  /**
   * Passwort-Reset Email senden
   */
  async sendPasswordResetEmail(to: string, username: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await this.sendEmail({
      to,
      subject: 'KFZ Teilelager - Passwort zurücksetzen',
      html: `
        <h2>Passwort zurücksetzen</h2>
        <p>Hallo <strong>${username}</strong>,</p>
        <p>Sie haben eine Passwort-Zurücksetzung für Ihr KFZ Teilelager Konto angefordert.</p>
        <p><a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Passwort zurücksetzen</a></p>
        <p>Dieser Link ist für <strong>24 Stunden</strong> gültig.</p>
        <hr>
        <p><small>KFZ Teilelager System</small></p>
      `,
      text: `Passwort zurücksetzen\n\nHallo ${username},\n\n${resetUrl}\n\nKFZ Teilelager System`,
    });
  }

  /**
   * Überprüft ob Email-Service konfiguriert ist (branch-spezifisch mit globalem Fallback)
   */
  async isConfigured(branchId?: string | null): Promise<boolean> {
    const host = await this.loggingService.getConfig('email.host', branchId ?? undefined);
    const user = await this.loggingService.getConfig('email.user', branchId ?? undefined);
    const password = await this.loggingService.getConfig('email.password', branchId ?? undefined);
    return !!(host && user && password);
  }

  /**
   * Gibt die aktuelle Email-Konfiguration zurück (ohne Passwort)
   */
  async getConfiguration(branchId?: string | null): Promise<Partial<EmailConfig> | null> {
    const host = await this.loggingService.getConfig('email.host', branchId ?? undefined);
    const port = await this.loggingService.getConfig('email.port', branchId ?? undefined);
    const secure = await this.loggingService.getConfig('email.secure', branchId ?? undefined);
    const user = await this.loggingService.getConfig('email.user', branchId ?? undefined);
    const from = await this.loggingService.getConfig('email.from', branchId ?? undefined);

    if (!host || !port || !user || !from) return null;

    return {
      host,
      port: parseInt(port),
      secure: secure === 'true',
      auth: { user, pass: '' }, // Passwort nicht zurückgeben
      from,
    };
  }
}
