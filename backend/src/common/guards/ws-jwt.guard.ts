import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient();
      const authHeader: string | undefined =
        client.handshake?.auth?.token || client.handshake?.headers?.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      if (!token) throw new WsException("Unauthorized");
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get("auth.jwtSecret"),
      });
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException("Unauthorized");
    }
  }
}
