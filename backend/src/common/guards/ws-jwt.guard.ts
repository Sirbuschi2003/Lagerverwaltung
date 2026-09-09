import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const authHeaderRaw = client.handshake?.auth?.token as string | undefined;
      const authHeader: string | undefined =
        authHeaderRaw || client.handshake?.headers?.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      if (!token) throw new WsException("Unauthorized");
      const payload: unknown = this.jwtService.verify(token, {
        secret: this.configService.get<string>("auth.jwtSecret"),
      });
      (client.data as { user?: unknown }).user = payload;
      return true;
    } catch {
      throw new WsException("Unauthorized");
    }
  }
}
