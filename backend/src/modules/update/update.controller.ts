import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
  Request,
} from "@nestjs/common";
import { UpdateService, UpdateStatus } from "./update.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("update")
@UseGuards(JwtAuthGuard)
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get("status")
  @SkipThrottle()
  async getStatus(
    @Query("refresh") refresh?: string,
  ): Promise<UpdateStatus> {
    return this.updateService.getStatus(refresh === "true");
  }

  @Get("changelog")
  @SkipThrottle()
  async getChangelog(): Promise<{ content: string }> {
    const content = await this.updateService.getChangelog();
    return { content };
  }

  @Post("apply")
  async applyUpdate(
    @Request() req: any,
  ): Promise<{ message: string }> {
    const user = req.user;
    if (!user || user.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können Updates einspielen.");
    }
    return this.updateService.applyUpdate();
  }
}
