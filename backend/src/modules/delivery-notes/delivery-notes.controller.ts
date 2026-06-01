import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import fs from "node:fs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DeliveryNotesService } from "./delivery-notes.service";

@Controller("delivery-notes")
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  /** Gibt zurück welche Vorgangsnummern einen Lieferschein haben */
  @UseGuards(JwtAuthGuard)
  @Get("exists")
  async exists(@Query("vorgangsnummern") raw: string) {
    const vnrs = (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const found = await this.service.existsForVorgangsnummern(vnrs);
    return { vorgangsnummern: Array.from(found) };
  }

  /** Streamt das PDF für eine Vorgangsnummer – kein Auth-Guard nötig da Token per Query übergeben */
  @Get("download")
  async download(
    @Query("vorgangsnummer") vorgangsnummer: string,
    @Res() res: Response,
  ) {
    if (!vorgangsnummer) throw new NotFoundException();

    const note = await this.service.findByVorgangsnummer(vorgangsnummer);
    if (!note) throw new NotFoundException("Kein Lieferschein gefunden");

    const absPath = this.service.getAbsolutePath(note.filePath);
    if (!fs.existsSync(absPath)) throw new NotFoundException("Datei nicht gefunden");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${vorgangsnummer}.pdf"`);
    fs.createReadStream(absPath).pipe(res);
  }
}
