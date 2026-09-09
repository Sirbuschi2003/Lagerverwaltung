import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, StreamableFile, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { SendPurchaseOrderDto } from "./dto/send-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { PurchaseOrderStatus } from "./entities/purchase-order.entity";
import { PurchasingService, PurchaseOrderSortField, SortDirection } from "./purchasing.service";

@Controller("purchase-orders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get("suggestions")
  @Permissions("orders.view")
  suggestions(
    @Req() req: Request,
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
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("year") year?: string,
    @Query("supplierId") supplierId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedYear = year ? Number.parseInt(year, 10) : undefined;
    const parsedPage = page ? Math.max(1, Number.parseInt(page, 10)) : 1;
    const parsedLimit = limit ? Math.min(500, Math.max(1, Number.parseInt(limit, 10))) : 500;
    return this.purchasingService.findAll({
      status: status as PurchaseOrderStatus | undefined,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      supplierId: supplierId?.trim() || undefined,
      sortBy: sortBy as PurchaseOrderSortField | undefined,
      sortDir: sortDir as SortDirection | undefined,
      branchId: req.user?.branchId,
      locationIds: req.user?.locationIds,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get("documents")
  @Permissions("orders.view")
  listDocuments(
    @Req() req: Request,
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
  async downloadDocument(@Req() req: Request, @Query("path") relPath: string) {
    if (!relPath) throw new BadRequestException("Kein Pfad angegeben.");
    const result = await this.purchasingService.getOrderDocument(relPath, req.user?.branchId);
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get("purge-preview")
  @Permissions("orders.delete")
  purgePreview(@Req() req: Request, @Query("years") years?: string) {
    const y = years ? Number.parseInt(years, 10) : 10;
    return this.purchasingService.previewPurgeOldOrders(Number.isFinite(y) && y > 0 ? y : 10, req.user?.branchId);
  }

  @Delete("purge")
  @Permissions("orders.delete")
  purge(@Req() req: Request, @Query("years") years?: string) {
    const y = years ? Number.parseInt(years, 10) : 10;
    return this.purchasingService.purgeOldOrders(Number.isFinite(y) && y > 0 ? y : 10, req.user?.branchId);
  }

  @Get("items/:itemId/last-order")
  @Permissions("orders.view")
  lastOrderForItem(@Req() req: Request, @Param("itemId") itemId: string) {
    return this.purchasingService.getLastOrderForItem(itemId, req.user?.branchId);
  }

  @Get(":id")
  @Permissions("orders.view")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return this.purchasingService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("orders.create")
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: Request) {
    // Erstes Lager des Benutzers als Zuordnung speichern (null = kein Lager-Filter)
    const locationId = req.user?.locationIds?.length ? req.user.locationIds[0] : null;
    return this.purchasingService.create({ ...dto, branchId: req.user?.branchId, locationId });
  }

  @Patch(":id")
  @Permissions("orders.edit")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchasingService.update(id, dto, req.user?.branchId);
  }

  @Post(":id/lines")
  @Permissions("orders.edit")
  addLine(@Req() req: Request, @Param("id") id: string, @Body() body: { itemId: string; quantity: number }) {
    return this.purchasingService.addLine(id, body, req.user?.branchId);
  }

  @Patch(":id/lines/:lineId")
  @Permissions("orders.edit")
  updateLine(@Req() req: Request, @Param("id") id: string, @Param("lineId") lineId: string, @Body() body: { quantity: number }) {
    return this.purchasingService.updateLine(id, lineId, body, req.user?.branchId);
  }

  @Patch(":id/lines/reorder")
  @Permissions("orders.edit")
  reorderLines(@Req() req: Request, @Param("id") id: string, @Body("lineIds") lineIds: string[]) {
    if (!Array.isArray(lineIds) || lineIds.length === 0) throw new BadRequestException("lineIds erforderlich");
    return this.purchasingService.reorderLines(id, lineIds, req.user?.branchId);
  }

  @Delete(":id/lines/:lineId")
  @Permissions("orders.edit")
  removeLine(@Req() req: Request, @Param("id") id: string, @Param("lineId") lineId: string) {
    return this.purchasingService.removeLine(id, lineId, req.user?.branchId);
  }

  @Delete(":id")
  @Permissions("orders.delete")
  remove(@Req() req: Request, @Param("id") id: string) {
    return this.purchasingService.remove(id, req.user?.branchId);
  }

  @Post(":id/receive")
  @Permissions("orders.receive")
  receive(@Req() req: Request, @Param("id") id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchasingService.receiveOrder(id, dto, req.user?.id, req.user?.branchId);
  }

  @Get(":id/pdf")
  @Permissions("orders.view")
  async downloadPdf(@Req() req: Request, @Param("id") id: string) {
    const result = await this.purchasingService.getOrderPdf(id, req.user?.branchId);
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${result.filename}"`,
    });
  }

  @Post(":id/send")
  @Permissions("orders.send")
  async send(@Req() req: Request, @Param("id") id: string, @Body() dto: SendPurchaseOrderDto) {
    await this.purchasingService.sendOrderEmail(id, dto, req.user?.branchId);
    return { success: true };
  }
}
