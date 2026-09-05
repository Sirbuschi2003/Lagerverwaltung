import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ConsentService } from "./consent.service";
import { GrantConsentDto } from "./dto/consent.dto";

// DSGVO Art. 6/7: Consent management endpoints
@Controller("consent")
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  // Return current user's active consents
  @Get()
  async getMyConsents(@CurrentUser() user: { id: string }) {
    return this.consentService.getActiveConsents(user.id);
  }

  // Return full consent history
  @Get("history")
  async getMyConsentHistory(@CurrentUser() user: { id: string }) {
    return this.consentService.getConsentHistory(user.id);
  }

  // Grant or update consent for a purpose
  @Post()
  async grantConsent(
    @CurrentUser() user: { id: string },
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ) {
    const ip = this.anonymizeIp(req.ip ?? req.socket?.remoteAddress ?? null);
    const ua = (req.headers["user-agent"] ?? null) as string | null;
    return this.consentService.grantConsent(user.id, dto, ip, ua);
  }

  // Revoke consent for a specific purpose
  @Delete(":purpose")
  async revokeConsent(
    @CurrentUser() user: { id: string },
    @Param("purpose") purpose: string,
  ) {
    await this.consentService.revokeConsent(user.id, purpose);
    return { revoked: true, purpose };
  }

  // Revoke all consents (e.g. on account deletion)
  @Delete()
  async revokeAll(@CurrentUser() user: { id: string }) {
    await this.consentService.revokeAllConsents(user.id);
    return { revoked: true };
  }

  private anonymizeIp(ip: string | null): string | null {
    if (!ip) return null;
    if (ip.includes(":")) {
      // IPv6: keep first 3 groups, zero the rest
      const parts = ip.split(":");
      return parts.slice(0, 3).join(":") + ":0000:0000:0000:0000:0000";
    }
    // IPv4: zero last octet
    return ip.replace(/\.\d+$/, ".0");
  }
}
