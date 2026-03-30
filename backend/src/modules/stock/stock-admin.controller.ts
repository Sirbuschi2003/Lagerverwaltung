import { Controller, Post, UseGuards } from '@nestjs/common';

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
  async repairDuplicateStockLevels() {
    return this.stockService.repairDuplicateStockLevels();
  }

  @Post('diagnose-stock-levels')
  @Roles('MANAGER')
  async diagnoseStockLevels() {
    return this.stockService.diagnoseStockLevels();
  }
}