import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { UsersService } from "../modules/users/users.service";

@Injectable()
export class DefaultAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAdminSeeder.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const username = this.configService.get<string>("seed.adminUsername") ?? "admin";
    const password = this.configService.get<string>("seed.adminPassword") ?? "ChangeMe123!";
    const displayName =
      this.configService.get<string>("seed.adminDisplayName") ?? "System Administrator";

    if (!username || !password) {
      this.logger.warn("Default admin seeding skipped (missing credentials)");
      return;
    }

    const existing = await this.usersService.findOneByUsername(username);
    if (existing) {
      return;
    }

    await this.usersService.create({
      username,
      password,
      displayName,
      role: "MANAGER",
    });

    this.logger.log(`Default admin '${username}' erstellt.`);
  }
}
