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

@Controller("update")
@UseGuards(JwtAuthGuard)
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get("status")
  async getStatus(
    @Query("refresh") refresh?: string,
  ): Promise<UpdateStatus> {
    return this.updateService.getStatus(refresh === "true");
  }

  @Post("apply")
  async applyUpdate(
    @Request() req: any,
  ): Promise<{ message: string }> {
    const user = req.user;
    if (!user || user.role !== "ADMIN") {
      throw new ForbiddenException("Nur Administratoren können Updates einspielen.");
    }
    return this.updateService.applyUpdate();
  }
}
