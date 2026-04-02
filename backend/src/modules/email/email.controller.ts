import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LoggingService } from '../logging/services/logging.service';

import { EmailService, EmailConfig } from './email.service';

interface EmailRequest extends Request {
  user?: { id?: string; username?: string; branchId?: string | null };
}

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('config')
  @Roles('MANAGER')
  async getEmailConfig(@Req() req: EmailRequest) {
    const branchId = req.user?.branchId ?? null;
    const config = await this.emailService.getConfiguration(branchId);
    const isConfigured = await this.emailService.isConfigured(branchId);
    return { isConfigured, config: config || {} };
  }

  @Post('config')
  @Roles('MANAGER')
  async setEmailConfig(@Body() config: EmailConfig, @Req() req: EmailRequest) {
    if (!config.host || !config.port || !config.auth?.user || !config.auth?.pass || !config.from) {
      throw new BadRequestException('Alle Felder sind erforderlich');
    }
    if (config.port < 1 || config.port > 65535) {
      throw new BadRequestException('Port muss zwischen 1 und 65535 liegen');
    }
    if (!this.isValidEmail(config.from) || !this.isValidEmail(config.auth.user)) {
      throw new BadRequestException('Ungültige Email-Adresse');
    }

    const branchId = req.user?.branchId ?? null;

    try {
      await this.emailService.configureTransport(config, branchId);

      if (req.user) {
        await this.loggingService.logSecurity(
          'EMAIL_CONFIG_UPDATED',
          `Email-Konfiguration aktualisiert von ${req.user.username}${branchId ? '' : ' (global)'}`,
          {
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: { host: config.host, port: config.port, user: config.auth.user, from: config.from, branchId },
          },
        );
      }

      return { success: true, message: 'Email-Konfiguration gespeichert' };
    } catch (error) {
      throw new BadRequestException(
        `Konfiguration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('test')
  @Roles('MANAGER')
  async sendTestEmail(@Body() body: { email: string }, @Req() req: EmailRequest) {
    if (!body.email || !this.isValidEmail(body.email)) {
      throw new BadRequestException('Gültige Email-Adresse erforderlich');
    }

    const branchId = req.user?.branchId ?? null;

    try {
      await this.emailService.sendTestEmail(body.email, branchId);

      if (req.user) {
        await this.loggingService.logInfo(
          'SYSTEM' as any,
          'EMAIL_TEST_SENT',
          `Test-Email gesendet an ${body.email} von ${req.user.username}`,
          { userId: req.user.id, metadata: { recipient: body.email } },
        );
      }

      return { success: true, message: `Test-Email an ${body.email} gesendet` };
    } catch (error) {
      throw new BadRequestException(
        `Test-Email fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('password-reset')
  async requestPasswordReset(@Body() body: { username: string }) {
    if (!body.username) {
      throw new BadRequestException('Benutzername erforderlich');
    }
    return {
      success: true,
      message: 'Falls der Benutzer existiert, wurde eine Passwort-Reset Email gesendet',
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
