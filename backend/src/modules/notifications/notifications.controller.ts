import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("public-key")
  async getPublicKey() {
    const publicKey = await this.notificationsService.getPublicKey();
    return { publicKey };
  }

  @Post("subscribe")
  async subscribe(@Req() req: any, @Body() body: { subscription: any }) {
    const userId = req.user?.id;
    if (!userId || !body?.subscription) {
      return { success: false };
    }
    await this.notificationsService.saveSubscription(userId, body.subscription);
    return { success: true };
  }
}
