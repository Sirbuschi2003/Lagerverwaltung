import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { UsersService } from "../../users/users.service";

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>("auth.jwtSecret");
    if (!jwtSecret) {
      throw new Error("auth.jwtSecret ist nicht konfiguriert (JWT_SECRET fehlt)");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<Express.User | null> {
    // Load the full user from the database
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) return null;
    // Expose locationIds as flat array so controllers can read req.user.locationIds
    return {
      ...user,
      locationIds: user.locations?.map((l) => l.id) ?? [],
    };
  }
}
