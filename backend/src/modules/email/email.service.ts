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
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly loggingService: LoggingService) {}

  /**
   * Konfiguriert den Email-Transport
   */
  async configureTransport(config: EmailConfig): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
      });

      // Test die Konfiguration
      if (this.transporter) {
        await this.transporter.verify();
      }
      
      // Speichere Konfiguration (ohne Passwort)
      await this.loggingService.setConfig('email.host', config.host, 'SMTP Server Host');
      await this.loggingService.setConfig('email.port', config.port.toString(), 'SMTP Server Port');
      await this.loggingService.setConfig('email.secure', config.secure.toString(), 'SMTP TLS/SSL');
      await this.loggingService.setConfig('email.user', config.auth.user, 'SMTP Benutzername');
      await this.loggingService.setConfig('email.password', config.auth.pass, 'SMTP Passwort', true);
      await this.loggingService.setConfig('email.from', config.from, 'Standard Absender-Adresse');

      await this.loggingService.logInfo(
        'SYSTEM' as any,
        'EMAIL_CONFIG_UPDATED',
        `Email-Konfiguration aktualisiert: ${config.host}:${config.port}`,
        {
          metadata: { 
            host: config.host, 
            port: config.port, 
            secure: config.secure, 
            user: config.auth.user 
          }
        }
      );
    } catch (error) {
      await this.loggingService.logError(
        'SYSTEM' as any,
        'EMAIL_CONFIG_FAILED',
        `Email-Konfiguration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        { metadata: { error: error instanceof Error ? error.message : 'Unbekannter Fehler' } }
      );
      throw error;
    }
  }

  /**
   * Lädt die Email-Konfiguration aus der Datenbank
   */
  async loadConfiguration(): Promise<void> {
    const host = await this.loggingService.getConfig('email.host');
    const port = await this.loggingService.getConfig('email.port');
    const secure = await this.loggingService.getConfig('email.secure');
    const user = await this.loggingService.getConfig('email.user');
    const password = await this.loggingService.getConfig('email.password');
    const from = await this.loggingService.getConfig('email.from');

    if (host && port && user && password && from) {
      await this.configureTransport({
        host,
        port: parseInt(port),
        secure: secure === 'true',
        auth: { user, pass: password },
        from,
      });
    }
  }

  /**
   * Sendet eine Email
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.transporter) {
      await this.loadConfiguration();
      if (!this.transporter) {
        throw new Error('Email-Service nicht konfiguriert');
      }
    }

    try {
      const defaultFrom = await this.loggingService.getConfig('email.from');
      
      const mailOptions = {
        from: options.from || defaultFrom || '',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions) as { messageId?: string };

      await this.loggingService.logInfo(
        'SYSTEM' as any,
        'EMAIL_SENT',
        `Email gesendet: "${options.subject}" an ${mailOptions.to}`,
        {
          metadata: {
            to: mailOptions.to,
            subject: options.subject,
            messageId: info.messageId || 'unknown',
          }
        }
      );
    } catch (error) {
      await this.loggingService.logError(
        'SYSTEM' as any,
        'EMAIL_SEND_FAILED',
        `Email-Versand fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        {
          metadata: {
            to: options.to,
            subject: options.subject,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler',
          }
        }
      );
      throw error;
    }
  }

  /**
   * Test-Email senden
   */
  async sendTestEmail(to: string): Promise<void> {
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
      text: `
        Email-Test erfolgreich
        
        Diese Test-Email wurde erfolgreich vom KFZ Teilelager System gesendet.
        
        Zeitstempel: ${new Date().toLocaleString('de-DE')}
        
        KFZ Teilelager System
      `,
    });
  }

  /**
   * Passwort-Reset Email senden
   */
  async sendPasswordResetEmail(to: string, username: string, resetToken: string): Promise<void> {
    // Hier würde normalerweise die Frontend-URL aus der Konfiguration kommen
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to,
      subject: 'KFZ Teilelager - Passwort zurücksetzen',
      html: `
        <h2>Passwort zurücksetzen</h2>
        <p>Hallo <strong>${username}</strong>,</p>
        <p>Sie haben eine Passwort-Zurücksetzung für Ihr KFZ Teilelager Konto angefordert.</p>
        <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zu ändern:</p>
        <p><a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Passwort zurücksetzen</a></p>
        <p>Dieser Link ist für <strong>24 Stunden</strong> gültig.</p>
        <p>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese Email.</p>
        <hr>
        <p><small>KFZ Teilelager System</small></p>
      `,
      text: `
        Passwort zurücksetzen
        
        Hallo ${username},
        
        Sie haben eine Passwort-Zurücksetzung für Ihr KFZ Teilelager Konto angefordert.
        
        Öffnen Sie den folgenden Link in Ihrem Browser, um Ihr Passwort zu ändern:
        ${resetUrl}
        
        Dieser Link ist für 24 Stunden gültig.
        
        Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese Email.
        
        KFZ Teilelager System
      `,
    });
  }

  /**
   * Überprüft ob Email-Service konfiguriert ist
   */
  async isConfigured(): Promise<boolean> {
    const host = await this.loggingService.getConfig('email.host');
    const user = await this.loggingService.getConfig('email.user');
    const password = await this.loggingService.getConfig('email.password');
    
    return !!(host && user && password);
  }

  /**
   * Gibt die aktuelle Email-Konfiguration zurück (ohne Passwort)
   */
  async getConfiguration(): Promise<Partial<EmailConfig> | null> {
    const host = await this.loggingService.getConfig('email.host');
    const port = await this.loggingService.getConfig('email.port');
    const secure = await this.loggingService.getConfig('email.secure');
    const user = await this.loggingService.getConfig('email.user');
    const from = await this.loggingService.getConfig('email.from');

    if (!host || !port || !user || !from) {
      return null;
    }

    return {
      host,
      port: parseInt(port),
      secure: secure === 'true',
      auth: { user, pass: '' }, // Passwort nicht zurückgeben
      from,
    };
  }
}
