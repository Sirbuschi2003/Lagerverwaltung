import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
  Request,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request as ExpressRequest } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { UpdateService, UpdateStatus } from "./update.service";

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
  applyUpdate(
    @Request() req: ExpressRequest,
  ): { message: string } {
    const user = req.user;
    if (!user || user.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können Updates einspielen.");
    }
    return this.updateService.applyUpdate();
  }
}
