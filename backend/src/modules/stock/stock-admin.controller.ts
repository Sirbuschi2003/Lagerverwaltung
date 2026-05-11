import { Controller, Post, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { StockService } from './stock.service';

@Controller('stock-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockAdminController {
  constructor(private readonly stockService: StockService) {}

  @Post('repair-duplicate-stock-levels')
  @Roles('MANAGER')
  async repairDuplicateStockLevels(@Req() req: { user?: { branchId?: string | null } }) {
    return this.stockService.repairDuplicateStockLevels(req.user?.branchId);
  }

  @Post('diagnose-stock-levels')
  @Roles('MANAGER')
  async diagnoseStockLevels(@Req() req: { user?: { branchId?: string | null } }) {
    return this.stockService.diagnoseStockLevels(req.user?.branchId);
  }
}