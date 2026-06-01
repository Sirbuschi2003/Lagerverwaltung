import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response, Request } from "express";
import fs from "node:fs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DeliveryNotesService } from "./delivery-notes.service";

@Controller("delivery-notes")
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  /** Temporärer Diagnose-Endpoint – kein Auth */
  @Get("debug")
  async debug() {
    return this.service.debugInfo();
  }

  @UseGuards(JwtAuthGuard)
  @Get("exists")
  async exists(@Query("vorgangsnummern") raw: string, @Req() req: Request) {
    const vnrs = (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const branchId = (req.user as any)?.branchId ?? null;
    const found = await this.service.existsForVorgangsnummern(vnrs, branchId);
    return { vorgangsnummern: Array.from(found) };
  }

  @UseGuards(JwtAuthGuard)
  @Get("download")
  async download(
    @Query("vorgangsnummer") vorgangsnummer: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!vorgangsnummer) throw new NotFoundException();

    const branchId = (req.user as any)?.branchId ?? null;
    const note = await this.service.findByVorgangsnummer(vorgangsnummer, branchId);
    if (!note) throw new NotFoundException("Kein Lieferschein gefunden");

    const absPath = this.service.getAbsolutePath(note.filePath);
    if (!fs.existsSync(absPath)) throw new NotFoundException("Datei nicht gefunden");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${vorgangsnummer}.pdf"`);
    fs.createReadStream(absPath).pipe(res);
  }
}
