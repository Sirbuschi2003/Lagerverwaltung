import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, StreamableFile, UseGuards } from "@nestjs/common";
import type { Request } from "express";

interface PurchasingRequest extends Request {
  user?: { id?: string; role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] };
}

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { SendPurchaseOrderDto } from "./dto/send-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { PurchasingService } from "./purchasing.service";

@Controller("purchase-orders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get("suggestions")
  @Permissions("orders.view")
  suggestions(
    @Req() req: PurchasingRequest,
    @Query("refresh") refresh?: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.purchasingService.getSuggestions(
      req.user?.branchId,
      refresh === "true" || refresh === "1",
      req.user?.locationIds,
      warehouseId,
    );
  }

  @Get()
  @Permissions("orders.view")
  findAll(
    @Req() req: PurchasingRequest,
    @Query("status") status?: string,
    @Query("year") year?: string,
    @Query("supplierId") supplierId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
  ) {
    const parsedYear = year ? Number.parseInt(year, 10) : undefined;
    return this.purchasingService.findAll({
      status: status as any,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      supplierId: supplierId?.trim() || undefined,
      sortBy: sortBy as any,
      sortDir: sortDir as any,
      branchId: req.user?.branchId,
      locationIds: req.user?.locationIds,
    });
  }

  @Get("documents")
  @Permissions("orders.view")
  listDocuments(
    @Req() req: PurchasingRequest,
    @Query("year") year?: string,
    @Query("supplierId") supplierId?: string,
  ) {
    const parsedYear = year ? Number.parseInt(year, 10) : undefined;
    return this.purchasingService.listOrderDocuments(
      {
        year: Number.isFinite(parsedYear) ? parsedYear : undefined,
        supplierId: supplierId?.trim() || undefined,
      },
      req.user?.branchId,
    );
  }

  @Get("documents/download")
  @Permissions("orders.view")
  async downloadDocument(@Req() req: PurchasingRequest, @Query("path") relPath: string) {
    if (!relPath) throw new BadRequestException("Kein Pfad angegeben.");
    const result = await this.purchasingService.getOrderDocument(relPath, req.user?.branchId);
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get("purge-preview")
  @Permissions("orders.delete")
  purgePreview(@Req() req: PurchasingRequest, @Query("years") years?: string) {
    const y = years ? Number.parseInt(years, 10) : 10;
    return this.purchasingService.previewPurgeOldOrders(Number.isFinite(y) && y > 0 ? y : 10, req.user?.branchId);
  }

  @Delete("purge")
  @Permissions("orders.delete")
  purge(@Req() req: PurchasingRequest, @Query("years") years?: string) {
    const y = years ? Number.parseInt(years, 10) : 10;
    return this.purchasingService.purgeOldOrders(Number.isFinite(y) && y > 0 ? y : 10, req.user?.branchId);
  }

  @Get("items/:itemId/last-order")
  @Permissions("orders.view")
  lastOrderForItem(@Req() req: PurchasingRequest, @Param("itemId") itemId: string) {
    return this.purchasingService.getLastOrderForItem(itemId, req.user?.branchId);
  }

  @Get(":id")
  @Permissions("orders.view")
  findOne(@Req() req: PurchasingRequest, @Param("id") id: string) {
    return this.purchasingService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("orders.create")
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: PurchasingRequest) {
    // Erstes Lager des Benutzers als Zuordnung speichern (null = kein Lager-Filter)
    const locationId = req.user?.locationIds?.length ? req.user.locationIds[0] : null;
    return this.purchasingService.create({ ...dto, branchId: req.user?.branchId, locationId });
  }

  @Patch(":id")
  @Permissions("orders.edit")
  update(@Req() req: PurchasingRequest, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchasingService.update(id, dto, req.user?.branchId);
  }

  @Post(":id/lines")
  @Permissions("orders.edit")
  addLine(@Req() req: PurchasingRequest, @Param("id") id: string, @Body() body: { itemId: string; quantity: number }) {
    return this.purchasingService.addLine(id, body, req.user?.branchId);
  }

  @Patch(":id/lines/:lineId")
  @Permissions("orders.edit")
  updateLine(@Req() req: PurchasingRequest, @Param("id") id: string, @Param("lineId") lineId: string, @Body() body: { quantity: number }) {
    return this.purchasingService.updateLine(id, lineId, body, req.user?.branchId);
  }

  @Delete(":id/lines/:lineId")
  @Permissions("orders.edit")
  removeLine(@Req() req: PurchasingRequest, @Param("id") id: string, @Param("lineId") lineId: string) {
    return this.purchasingService.removeLine(id, lineId, req.user?.branchId);
  }

  @Delete(":id")
  @Permissions("orders.delete")
  remove(@Req() req: PurchasingRequest, @Param("id") id: string) {
    return this.purchasingService.remove(id, req.user?.branchId);
  }

  @Post(":id/receive")
  @Permissions("orders.receive")
  receive(@Req() req: PurchasingRequest, @Param("id") id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchasingService.receiveOrder(id, dto, req.user?.id, req.user?.branchId);
  }

  @Get(":id/pdf")
  @Permissions("orders.view")
  async downloadPdf(@Req() req: PurchasingRequest, @Param("id") id: string) {
    const result = await this.purchasingService.getOrderPdf(id, req.user?.branchId);
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${result.filename}"`,
    });
  }

  @Post(":id/send")
  @Permissions("orders.send")
  async send(@Req() req: PurchasingRequest, @Param("id") id: string, @Body() dto: SendPurchaseOrderDto) {
    await this.purchasingService.sendOrderEmail(id, dto, req.user?.branchId);
    return { success: true };
  }
}
