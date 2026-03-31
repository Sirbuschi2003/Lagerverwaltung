import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, InternalServerErrorException, BadRequestException, Logger, Res, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { plainToInstance } from "class-transformer";
import type { Request, Response } from "express";

interface ItemsRequest extends Request {
  user?: { id?: string; username?: string; role?: string };
}

import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { ItemsService } from "./items.service";
import { Item } from "./entities/item.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { SkipThrottle } from "@nestjs/throttler";

@SkipThrottle()
@Controller("items")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemsController {
  private readonly logger = new Logger(ItemsController.name);

  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @Permissions("items.view")
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("manufacturer") manufacturer?: string,
    @Query("productGroup") productGroup?: string,
  ) {
    try {
      // Validiere Parameter
      if (page && isNaN(parseInt(page, 10))) {
        throw new BadRequestException('Parameter "page" muss eine gültige Zahl sein');
      }
      if (limit && isNaN(parseInt(limit, 10))) {
        throw new BadRequestException('Parameter "limit" muss eine gültige Zahl sein');
      }

      this.logger.debug(`Items Anfrage: page=${page}, limit=${limit}, search=${search}, manufacturer=${manufacturer}, productGroup=${productGroup}`);

      const result = await this.itemsService.findAll({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        search,
        manufacturer,
        productGroup,
      });

      return {
        ...result,
        items: result.items.map((item: Item) => ({
          ...item,
          alternateCodes: item.codes ? item.codes.map(code => code.code) : [],
        })),
      };
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen der Artikel: ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error && error.message.includes('database')) {
        this.logger.error('Datenbankverbindungsfehler', error);
        throw new InternalServerErrorException('Datenbankfehler: Verbindung fehlgeschlagen');
      }

      this.logger.error('Unerwarteter Fehler:', error);
      throw new InternalServerErrorException('Artikel konnten nicht abgerufen werden');
    }
  }

  @Post()
  @Permissions("items.create")
  async create(@Body() dto: CreateItemDto) {
    try {
      this.logger.debug(`Erstelle neuen Artikel: ${dto.code}`);
      return await this.itemsService.create(dto);
    } catch (error) {
      this.logger.error(`Fehler beim Erstellen des Artikels: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes('bereits vergeben')) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Artikel konnte nicht erstellt werden');
    }
  }

  @Post("bulk")
  @Permissions("items.create")
  async createBulk(@Body() dto: CreateItemDto[]) {
    try {
      this.logger.debug(`Erstelle ${dto?.length || 0} Artikel in Bulk`);
      return await this.itemsService.createBulk(dto);
    } catch (error) {
      this.logger.error(`Fehler beim Bulk-Erstellen: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Bulk-Import konnte nicht durchgeführt werden');
    }
  }

  @Post("bulk/preview")
  @Permissions("items.create")
  async previewBulk(
    @Body() dto: CreateItemDto[],
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    rows: Array<{ row: number; code: string; action: "CREATE" | "UPDATE" | "SKIP" | "ERROR"; reason: string | null }>;
  }> {
    try {
      this.logger.debug(`Preview fuer ${dto?.length || 0} Artikel in Bulk`);
      return await this.itemsService.previewBulk(dto);
    } catch (error) {
      this.logger.error(`Fehler beim Bulk-Preview: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException("Bulk-Preview konnte nicht durchgeführt werden");
    }
  }

  @Delete("bulk")
  @Permissions("items.delete")
  async removeAll() {
    try {
      this.logger.debug("[ItemsController] removeAll endpoint called");
      const result = await this.itemsService.removeAll();
      this.logger.log(`[ItemsController] removeAll completed: ${result.deleted} items deleted`);
      return result;
    } catch (error) {
      this.logger.error(`[ItemsController] removeAll error: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Löschen aller Artikel fehlgeschlagen');
    }
  }

  @Get("export/csv")
  @Permissions("items.view")
  async exportCsv(
    @Res() res: Response,
    @Query("search") search?: string,
    @Query("manufacturer") manufacturer?: string,
    @Query("productGroup") productGroup?: string,
  ) {
    try {
      const csvBuffer = await this.itemsService.exportItemsCsv({
        search,
        manufacturer,
        productGroup,
      });
      const date = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="artikel_stammdaten_${date}.csv"`);
      return res.send(csvBuffer);
    } catch (error) {
      this.logger.error(`Fehler beim CSV-Export: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException("Artikel-CSV konnte nicht erstellt werden");
    }
  }

  @Get("by-code/:code")
  @Permissions("items.view")
  async findByCode(@Param("code") code: string) {
    try {
      this.logger.debug(`Suche Artikel nach Code: ${code}`);
      const item = await this.itemsService.findOneByAnyCode(code);
      if (!item) {
        throw new NotFoundException('Item not found');
      }
      return {
        ...item,
        alternateCodes: item.codes ? item.codes.map(code => code.code) : []
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Fehler bei Codesuche: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Artikel konnte nicht gefunden werden');
    }
  }

  @Post(":id/image")
  @Permissions("items.edit")
  @UseInterceptors(FileInterceptor("image", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Keine Datei angegeben");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Nur JPEG, PNG, WebP und GIF sind erlaubt");
    }
    try {
      const item = await this.itemsService.uploadImage(id, file);
      return { ...item, alternateCodes: item.codes ? item.codes.map(c => c.code) : [] };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Fehler beim Bild-Upload: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException("Bild konnte nicht gespeichert werden");
    }
  }

  @Delete(":id/image")
  @Permissions("items.edit")
  async deleteImage(@Param("id") id: string) {
    try {
      const item = await this.itemsService.deleteImage(id);
      return { ...item, alternateCodes: item.codes ? item.codes.map(c => c.code) : [] };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException("Bild konnte nicht gelöscht werden");
    }
  }

  @Get(":id/image")
  @Permissions("items.view")
  async getImage(@Param("id") id: string, @Res() res: Response) {
    const item = await this.itemsService.findOne(id);
    if (!item?.imagePath) throw new NotFoundException("Kein Bild vorhanden");
    const filepath = this.itemsService.getImageFilePath(item.imagePath);
    try {
      return res.sendFile(filepath);
    } catch {
      throw new NotFoundException("Bilddatei nicht gefunden");
    }
  }

  @Get(":id")
  @Permissions("items.view")
  async findOne(@Param("id") id: string) {
    try {
      this.logger.debug(`Suche Artikel nach ID: ${id}`);
      const item = await this.itemsService.findOne(id);
      if (!item) {
        throw new NotFoundException('Item not found');
      }
      return {
        ...item,
        alternateCodes: item.codes ? item.codes.map(code => code.code) : []
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Fehler bei ID-Suche: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Artikel konnte nicht gefunden werden');
    }
  }

  @Patch("bulk")
  @Permissions("items.edit")
  async updateBulk(@Body() updates: Array<UpdateItemDto & { id: string }>) {
    try {
      this.logger.debug(`Bulk-Update von ${updates?.length || 0} Artikeln`);
      return await this.itemsService.updateBulk(updates);
    } catch (error) {
      this.logger.error(`Fehler beim Bulk-Update: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Bulk-Update konnte nicht durchgeführt werden');
    }
  }

  @Patch(":id")
  @Permissions("items.edit")
  async update(@Param("id") id: string, @Body() dto: UpdateItemDto) {
    try {
      this.logger.debug(`Aktualisiere Artikel ${id}`);
      const item = await this.itemsService.update(id, dto);
      return {
        ...item,
        alternateCodes: item.codes ? item.codes.map(code => code.code) : []
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Fehler beim Aktualisieren: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes('bereits vergeben')) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Artikel konnte nicht aktualisiert werden');
    }
  }

  @Delete(":id")
  @Permissions("items.delete")
  async remove(@Req() req: ItemsRequest, @Param("id") id: string) {
    try {
      await this.itemsService.remove(id, req.user?.id);
    } catch (error) {
      this.logger.error(`Fehler beim Loeschen: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Artikel konnte nicht geloescht werden');
    }
  }
}
