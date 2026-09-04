import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    sub?: string;
  };
}

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,        // Kein JavaScript-Zugriff (XSS-Schutz)
    secure: process.env.NODE_ENV === "production", // HTTPS-only in Production
    sameSite: "strict",    // CSRF-Schutz
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",     // Nur für Auth-Endpunkte
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(this.extractUserId(req));
  }

  // Max. 10 Login-Versuche pro 15 Minuten pro IP (Brute-Force-Schutz)
  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const context = this.buildRequestContext(req);
    const user = await this.authService.validateUser(dto.username, dto.password, context);
    const result = await this.authService.login(user, context);

    if ('refreshToken' in result) {
      // Full login: set secure cookie, strip refreshToken from body
      setRefreshCookie(res, result.refreshToken);
      const { refreshToken: _rt, ...safeResult } = result;
      return safeResult;
    }

    // MFA challenge — no cookie yet, return challenge payload
    return result;
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const context = this.buildRequestContext(req);
    // Refresh-Token aus HttpOnly-Cookie lesen (Fallback: Body für Rückwärtskompatibilität)
    const refreshToken: string = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE_NAME]
      ?? (req.body as Record<string, string>)?.refreshToken;

    if (!refreshToken) {
      throw new Error("Kein Refresh-Token gefunden");
    }

    const result = await this.authService.refresh(refreshToken, context);

    // Neuen Refresh-Token als Cookie setzen
    setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...safeResult } = result;
    return safeResult;
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken: string | undefined =
      (req.cookies as Record<string, string>)?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(refreshToken);
    clearRefreshCookie(res);
    return { success: true };
  }

  // Max. 5 Reset-Anfragen pro Stunde pro IP
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  @Post("request-password-reset")
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    const context = this.buildRequestContext(req);

    return this.authService.requestPasswordReset(dto.email, context);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const context = this.buildRequestContext(req);

    return this.authService.resetPassword(dto.token, dto.newPassword, context);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthenticatedRequest) {
    const context = this.buildRequestContext(req);
    const userId = this.extractUserId(req);

    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword, context);
  }

  /** Step 2 of MFA login — exchange mfaToken + TOTP code for real tokens. */
  @Post("mfa/verify")
  async verifyMfaLogin(
    @Body() body: { mfaToken: string; totpCode: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = this.buildRequestContext(req);
    const result = await this.authService.completeMfaLogin(body.mfaToken, body.totpCode, context);
    if ('refreshToken' in result) {
      setRefreshCookie(res, result.refreshToken);
      const { refreshToken: _rt, ...safe } = result;
      return safe;
    }
    return result;
  }

  /** Initiates MFA TOTP setup — returns QR code (data URL) and plain secret. */
  @UseGuards(JwtAuthGuard)
  @Post("mfa/setup")
  async setupMfa(@Req() req: AuthenticatedRequest) {
    return this.authService.setupMfa(this.extractUserId(req));
  }

  /** Confirms TOTP code after scanning QR code and activates MFA. */
  @UseGuards(JwtAuthGuard)
  @Post("mfa/verify-setup")
  async verifyMfaSetup(@Body() body: { totpCode: string }, @Req() req: AuthenticatedRequest) {
    return this.authService.verifyMfaSetup(this.extractUserId(req), body.totpCode);
  }

  /** MFA-Bootstrap Step 1: initiate setup using mfaSetupToken (no full JWT, for new admins). */
  @Post("mfa/setup-init")
  async setupMfaInit(@Body() body: { mfaSetupToken: string }) {
    return this.authService.setupMfaViaSetupToken(body.mfaSetupToken);
  }

  /** MFA-Bootstrap Step 2: confirm TOTP + receive full auth tokens (no full JWT needed). */
  @Post("mfa/verify-setup-init")
  async verifyMfaSetupInit(
    @Body() body: { mfaSetupToken: string; totpCode: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = this.buildRequestContext(req);
    const result = await this.authService.verifyMfaSetupViaSetupToken(body.mfaSetupToken, body.totpCode, context);
    if ('refreshToken' in result) {
      setRefreshCookie(res, result.refreshToken as string);
      const { refreshToken: _rt, ...safe } = result as Record<string, unknown>;
      return safe;
    }
    return result;
  }

  /** Disables MFA (requires password confirmation). */
  @UseGuards(JwtAuthGuard)
  @Post("mfa/disable")
  async disableMfa(@Body() body: { password: string }, @Req() req: AuthenticatedRequest) {
    return this.authService.disableMfa(this.extractUserId(req), body.password);
  }

  /** Returns current MFA status for the logged-in user. */
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get("mfa/status")
  async getMfaStatus(@Req() req: AuthenticatedRequest) {
    const userId = this.extractUserId(req);
    const user = await this.authService.getProfile(userId);
    return { mfaEnabled: (user as any).mfaEnabled ?? false };
  }

  private extractUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new Error("No user ID found in request");
    }
    return userId;
  }

  private buildRequestContext(req: Request): RequestContext {
    return {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? "",
      userAgent: req.get("user-agent") ?? "unknown",
    };
  }
}
