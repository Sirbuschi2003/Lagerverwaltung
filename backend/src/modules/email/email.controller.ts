import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LoggingService } from '../logging/services/logging.service';

import { EmailService, EmailConfig } from './email.service';


@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Email-Konfiguration abrufen (nur für Manager)
   */
  @Get('config')
  @Roles('MANAGER')
  async getEmailConfig() {
    const config = await this.emailService.getConfiguration();
    const isConfigured = await this.emailService.isConfigured();
    
    return {
      isConfigured,
      config: config || {},
    };
  }

  /**
   * Email-Konfiguration setzen (nur für Manager)
   */
  @Post('config')
  @Roles('MANAGER')
  async setEmailConfig(@Body() config: EmailConfig, @Req() req?: any) {
    // Validierung
    if (!config.host || !config.port || !config.auth?.user || !config.auth?.pass || !config.from) {
      throw new BadRequestException('Alle Felder sind erforderlich');
    }

    if (config.port < 1 || config.port > 65535) {
      throw new BadRequestException('Port muss zwischen 1 und 65535 liegen');
    }

    if (!this.isValidEmail(config.from) || !this.isValidEmail(config.auth.user)) {
      throw new BadRequestException('Ungültige Email-Adresse');
    }

    try {
      await this.emailService.configureTransport(config);

      // Log die Konfiguration (ohne Passwort)
      if (req?.user) {
        await this.loggingService.logSecurity(
          'EMAIL_CONFIG_UPDATED',
          `Email-Konfiguration aktualisiert von ${req.user.username}`,
          {
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
              host: config.host,
              port: config.port,
              user: config.auth.user,
              from: config.from
            }
          }
        );
      }

      return { success: true, message: 'Email-Konfiguration gespeichert' };
    } catch (error) {
      throw new BadRequestException(
        `Konfiguration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    }
  }

  /**
   * Test-Email senden (nur für Manager)
   */
  @Post('test')
  @Roles('MANAGER')
  async sendTestEmail(@Body() body: { email: string }, @Req() req?: any) {
    if (!body.email || !this.isValidEmail(body.email)) {
      throw new BadRequestException('Gültige Email-Adresse erforderlich');
    }

    try {
      await this.emailService.sendTestEmail(body.email);

      // Log die Test-Email
      if (req?.user) {
        await this.loggingService.logInfo(
          'SYSTEM' as any,
          'EMAIL_TEST_SENT',
          `Test-Email gesendet an ${body.email} von ${req.user.username}`,
          {
            userId: req.user.id,
            metadata: { recipient: body.email }
          }
        );
      }

      return { success: true, message: `Test-Email an ${body.email} gesendet` };
    } catch (error) {
      throw new BadRequestException(
        `Test-Email fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    }
  }

  /**
   * Passwort-Reset Email anfordern (für alle authentifizierten Benutzer)
   */
  @Post('password-reset')
  async requestPasswordReset(@Body() body: { username: string }, @Req() req?: any) {
    if (!body.username) {
      throw new BadRequestException('Benutzername erforderlich');
    }

    // TODO: Implementierung der Passwort-Reset Logik
    // Hier wird später die Token-Generierung und Email-Versand implementiert

    return { 
      success: true, 
      message: 'Falls der Benutzer existiert, wurde eine Passwort-Reset Email gesendet' 
    };
  }

  /**
   * Email-Adresse validieren
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}