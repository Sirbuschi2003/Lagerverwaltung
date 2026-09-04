import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { createHmac } from "crypto";

import { ItemsService } from "../items/items.service";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockService } from "../stock/stock.service";
import { VehiclesService } from "../vehicles/vehicles.service";
import { LoggingService } from "../logging/services/logging.service";
import { LogLevel, LogCategory } from "../logging/entities/system-log.entity";
import { User } from "../users/entities/user.entity";

import { CompleteInventoryDto } from "./dto/complete-inventory.dto";
import { RecordInventoryLineDto } from "./dto/record-inventory-line.dto";
import { FinalizeInventoryDto } from "./dto/finalize-inventory.dto";
import { SubmitInventoryDto } from "./dto/submit-inventory.dto";
import { RemoveVehicleStockDto } from "./dto/remove-vehicle-stock.dto";
import { StartInventoryDto } from "./dto/start-inventory.dto";
import { InventoryLine } from "./entities/inventory-line.entity";
import { InventorySession, InventorySessionStatus } from "./entities/inventory-session.entity";
import { InventoryVehicleStatus, InventoryVehicleStatusState } from "./entities/inventory-vehicle-status.entity";

export type InventoryDifference = {
  lineId: string;
  itemId: string;
  vehicleId: string | null;
  locationId: string | null;
  itemCode: string;
  itemDescription: string;
  manufacturer: string;
  productGroup: string;
  vehicleLabel: string | null;
  countedQuantity: number;
  expectedQuantity: number;
  delta: number;
};

@Injectable()
export class InventoryService {
  private readonly hmacSecret: string;

  constructor(
    @InjectRepository(InventorySession)
    private readonly sessionsRepository: Repository<InventorySession>,
    @InjectRepository(InventoryLine)
    private readonly linesRepository: Repository<InventoryLine>,
    @InjectRepository(InventoryVehicleStatus)
    private readonly vehicleStatusRepository: Repository<InventoryVehicleStatus>,
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly itemsService: ItemsService,
    private readonly stockService: StockService,
    private readonly vehiclesService: VehiclesService,
    private readonly loggingService: LoggingService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    // HMAC-Geheimnis für Inventur-Checksums (tamper-evident)
    const secret = this.configService.get<string>("INVENTORY_HMAC_SECRET");
    if (!secret) {
      throw new Error(
        "INVENTORY_HMAC_SECRET ist nicht konfiguriert. " +
        "Bitte setze diese Umgebungsvariable (min. 32 zufällige Zeichen). " +
        "Erzeuge einen Wert mit: openssl rand -hex 32",
      );
    }
    this.hmacSecret = `inventory-checksum-v1:${secret}`;
  }

  /**
   * Sessions mit branchId=null werden vom Super-Admin (branchId=null) angelegt und sind
   * niederlassungsübergreifend sichtbar — daher IS NULL immer mit einschließen, nicht nur
   * exakte Gleichheit prüfen. Analog zu delivery-notes.service.ts.
   */
  private sessionWhereForBranch(id: string, branchId?: string | null): Record<string, unknown>[] | Record<string, unknown> {
    if (!branchId) return { id };
    return [
      { id, branchId },
      { id, branchId: IsNull() },
    ];
  }

  async findSessions(branchId?: string | null, requestingUserId?: string, isManager?: boolean) {
    const qb = this.sessionsRepository
      .createQueryBuilder("session")
      .leftJoinAndSelect("session.vehicleStatuses", "vehicleStatuses")
      .leftJoinAndSelect("vehicleStatuses.vehicle", "vehicle")
      .leftJoinAndSelect("session.branch", "branch")
      .loadRelationCountAndMap("session.linesCount", "session.lines")
      .orderBy("session.startedAt", "DESC");

    if (branchId) {
      qb.andWhere("(session.branchId = :branchId OR session.branchId IS NULL)", { branchId });
    }

    const sessions = await qb.getMany();

    if (isManager) return sessions;
    // Nicht-Manager sehen nur Sitzungen ohne Zuordnung ODER die ihnen zugeordnet sind
    return sessions.filter(
      (s) => !s.assignedUserIds?.length || (!!requestingUserId && s.assignedUserIds.includes(requestingUserId)),
    );
  }

  findSessionById(id: string, branchId?: string | null) {
    return this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(id, branchId),
      relations: ["lines", "lines.item", "lines.item.storageLocation", "lines.vehicle", "lines.location", "vehicleStatuses", "vehicleStatuses.vehicle", "branch"],
    });
  }

  async getSessionDifferences(sessionId: string, userContext?: any, vehicleIdFilter?: string) {
    const session = await this.findSessionById(sessionId, userContext?.branchId);
    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    const isTechnician = userContext?.role === "TECHNICIAN";
    const technicianVehicleId = userContext?.vehicleId || null;

    let allDifferences: InventoryDifference[] = (session.lines || [])
      .map((line) => {
        const delta = line.countedQuantity - line.expectedQuantity;
        return {
          lineId: line.id,
          itemId: line.item?.id || "",
          vehicleId: line.vehicle?.id || null,
          // Fallback: wenn keine explizite Location gesetzt, item.storageLocation verwenden
          locationId: line.location?.id || (line.vehicle ? null : (line.item?.storageLocation?.id || null)),
          itemCode: line.item?.code || "",
          itemDescription: line.item?.description || "",
          manufacturer: line.item?.manufacturer || "",
          productGroup: line.item?.productGroup || "",
          vehicleLabel: line.vehicle?.licensePlate || null,
          countedQuantity: line.countedQuantity,
          expectedQuantity: line.expectedQuantity,
          delta,
        } as InventoryDifference;
      })
      .filter((diff) => diff.delta !== 0);

    // Filter: Techniker sieht nur Differenzen seines Fahrzeugs
    if (isTechnician && technicianVehicleId) {
      allDifferences = allDifferences.filter((diff) => diff.vehicleId === technicianVehicleId);
    }

    // Optionaler expliziter Fahrzeug-Filter (z. B. bei Teil-Submit)
    if (vehicleIdFilter) {
      allDifferences = allDifferences.filter((diff) => diff.vehicleId === vehicleIdFilter);
    }

    const totals = allDifferences.reduce(
      (acc, diff) => {
        acc.count += 1;
        acc.deltaSum += diff.delta;
        if (diff.delta > 0) {
          acc.positiveDeltaSum += diff.delta;
        }
        if (diff.delta < 0) {
          acc.negativeDeltaSum += diff.delta;
        }
        return acc;
      },
      { count: 0, deltaSum: 0, positiveDeltaSum: 0, negativeDeltaSum: 0 },
    );

    return {
      sessionId,
      differences: allDifferences,
      totals,
    };
  }

  async startSession(dto: StartInventoryDto & { branchId?: string | null }) {
    const session = this.sessionsRepository.create({
      name: dto.name,
      createdBy: dto.createdBy,
      location: dto.location?.trim() || null,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      completedAt: null,
      status: InventorySessionStatus.DRAFT,
      branchId: dto.branchId ?? null,
      assignedUserIds: dto.assignedUserIds?.length ? dto.assignedUserIds : null,
    });
    return this.sessionsRepository.save(session);
  }

  async recordLine(dto: RecordInventoryLineDto, branchId?: string | null) {
    await this.ensureSessionIsEditable(dto.sessionId, branchId);

    const session = await this.sessionsRepository.findOne({ where: this.sessionWhereForBranch(dto.sessionId, branchId) as any });
    if (!session) {
      throw new NotFoundException("Inventory session not found");
    }

    const item = await this.itemsService.findOne(dto.itemId);
    if (!item) {
      throw new NotFoundException("Item not found");
    }

    let vehicle = null;
    if (dto.vehicleId) {
      vehicle = await this.vehiclesService.findOne(dto.vehicleId);
      if (!vehicle) {
        throw new NotFoundException("Vehicle not found");
      }
    }

    let location: typeof item.storageLocation | null = null;
    if (!vehicle) {
      if (dto.locationId && item.storageLocation?.id === dto.locationId) {
        location = item.storageLocation;
      } else if (item.storageLocation) {
        location = item.storageLocation;
      }
    }

    await this.ensureVehicleEditable(dto.sessionId, dto.vehicleId || vehicle?.id || null);

    const line = this.linesRepository.create({
      session,
      item,
      vehicle: vehicle,
      location: location,
      countedQuantity: dto.countedQuantity,
      expectedQuantity: dto.expectedQuantity,
      note: dto.note ?? undefined,
    });

    return this.linesRepository.save(line);
  }

  async completeSession(dto: CompleteInventoryDto) {
    // Prüfe, ob Session editierbar ist
    await this.ensureSessionIsEditable(dto.sessionId);

    const session = await this.sessionsRepository.findOne({ where: { id: dto.sessionId } });
    if (!session) {
      throw new NotFoundException("Inventory session not found");
    }

    session.completedAt = new Date(dto.completedAt);
    return this.sessionsRepository.save(session);
  }

  async deleteLine(lineId: string) {
    const line = await this.linesRepository.findOne({
      where: { id: lineId },
      relations: ["session"],
    });
    if (!line) {
      throw new NotFoundException("Inventory line not found");
    }

    // Prüfe, ob Session editierbar ist
    await this.ensureSessionIsEditable(line.session.id);
    await this.ensureVehicleEditable(line.session.id, line.vehicle?.id || null);

    await this.linesRepository.remove(line);
    return { success: true };
  }

  async deleteSession(sessionId: string, branchId?: string | null, force = false) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId),
    });
    if (!session) {
      throw new NotFoundException("Inventory session not found");
    }
    if (session.status === InventorySessionStatus.FINALIZED && !force) {
      throw new ForbiddenException(
        "Abgeschlossene Inventuren unterliegen der gesetzlichen Aufbewahrungspflicht (§ 257 HGB, § 147 AO) " +
        "und können nicht manuell gelöscht werden. Die automatische Löschung erfolgt nach 10 Jahren.",
      );
    }
    await this.sessionsRepository.remove(session);
    return { success: true };
  }

  /**
   * Löscht abgeschlossene (FINALIZED) Inventuren automatisch nach Ablauf der
   * gesetzlichen Aufbewahrungsfrist von 10 Jahren (§ 257 HGB, § 147 AO).
   * Läuft täglich um 03:00 Uhr.
   */
  private readonly logger = new Logger(InventoryService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async deleteExpiredInventorySessions() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 10);

    const expired = await this.sessionsRepository
      .createQueryBuilder("s")
      .where("s.status = :status", { status: InventorySessionStatus.FINALIZED })
      .andWhere("s.finalizedAt < :cutoff", { cutoff })
      .getMany();

    if (expired.length === 0) return;

    await this.sessionsRepository.remove(expired);
    this.logger.log(
      `Aufbewahrungsfrist abgelaufen: ${expired.length} Inventur(en) automatisch gelöscht ` +
      `(finalizedAt < ${cutoff.toISOString().slice(0, 10)}).`,
    );
  }
  /**
   * Entfernt einen Artikel komplett aus dem Fahrzeugbestand (l�scht InventoryLine f�r vehicleId+itemId)
   */
  async removeVehicleStock(dto: RemoveVehicleStockDto) {
    await this.ensureSessionIsEditable(dto.sessionId);
    await this.ensureVehicleEditable(dto.sessionId, dto.vehicleId);

    // Suche alle InventoryLines f�r dieses Fahrzeug und Item
    const lines = await this.linesRepository.find({
      where: {
        vehicle: { id: dto.vehicleId },
        item: { id: dto.itemId },
      },
      relations: ["vehicle", "item"],
    });
    
    // Suche auch den entsprechenden StockLevel
    const stockLevels = await this.stockLevelsRepository.find({
      where: {
        vehicle: { id: dto.vehicleId },
        item: { id: dto.itemId },
      },
      relations: ["vehicle", "item"],
    });
    
    // InventoryLines und StockLevels atomar löschen — beide oder keiner
    await this.dataSource.transaction(async (manager) => {
      if (lines.length > 0) {
        await manager.remove(lines);
      }
      if (stockLevels.length > 0) {
        await manager.remove(stockLevels);
      }
    });
    
    if (lines.length === 0 && stockLevels.length === 0) {
      // Kein Fehler werfen, wenn bereits gelöscht - einfach erfolgreich zurückkehren
      return { deleted: 0, message: "Kein Bestand gefunden (möglicherweise bereits entfernt)" };
    }
    
    return { 
      deleted: lines.length + stockLevels.length,
      inventoryLinesDeleted: lines.length,
      stockLevelsDeleted: stockLevels.length
    };
  }

  /**
   * Techniker: Markiert Session als "Fertig (zur Prüfung)" → SUBMITTED
   * Keine Änderungen mehr für Techniker; Manager kann prüfen/reopen
   */
  async submitSession(sessionId: string, username: string, userContext?: any, dto?: SubmitInventoryDto) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, userContext?.branchId),
      relations: ["lines", "lines.location"],
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    if (session.status === InventorySessionStatus.FINALIZED || session.status === InventorySessionStatus.SUBMITTED) {
      throw new ConflictException(
        `Session ist bereits ${session.status}. Finalisierte oder bereits eingereichte Sessions können nicht erneut eingereicht werden.`,
      );
    }

    // Validierung: Session muss mindestens eine Zeile haben
    if (!session.lines || session.lines.length === 0) {
      throw new BadRequestException(
        "Session kann nicht eingereicht werden: Keine Zeilen vorhanden.",
      );
    }

    const userRole = userContext?.role as string | undefined;
    const userVehicleId = userContext?.vehicleId || null;
    const targetVehicleId = dto?.vehicleId || userVehicleId || null;

    // Für Techniker ist ein Fahrzeug zwingend nötig
    if (userRole === "TECHNICIAN" && !targetVehicleId) {
      throw new BadRequestException("Techniker müssen ein Fahrzeug zuweisen, um die Inventur einzureichen.");
    }

    // Server-Checksum berechnen (sortierte Lines)
    const serverChecksum = this.calculateSessionChecksum(session);

    const clientChecksum = dto?.clientChecksum;
    const applyAdjustments = Boolean(dto?.applyAdjustments);
    session.clientChecksum = clientChecksum || null;
    session.serverChecksum = serverChecksum;

    // per-Fahrzeug-Teil-Submit
    if (targetVehicleId) {
      // Check: Fahrzeug muss in den Zeilen vorkommen
      const hasVehicleLines = session.lines.some((l) => l.vehicle?.id === targetVehicleId);
      if (!hasVehicleLines) {
        throw new BadRequestException("Für dieses Fahrzeug liegen keine Inventurzeilen vor.");
      }

      const vehicleStatus = await this.getOrCreateVehicleStatus(session, targetVehicleId);

      if (vehicleStatus.status === InventoryVehicleStatusState.SUBMITTED) {
        throw new ConflictException("Dieses Fahrzeug wurde bereits zur Prüfung eingereicht.");
      }

      // Optional: automatische Buchung nur für dieses Fahrzeug (mit Delta-Logik)
      let differencesApplied = false;
      let differenceCount = 0;
      let deltaSum = 0;

      if (applyAdjustments) {
        const differenceResult = await this.getSessionDifferences(sessionId, userContext, targetVehicleId);
        differenceCount = differenceResult.differences.length;
        deltaSum = differenceResult.totals.deltaSum;
        const hasDifferences = differenceCount > 0;

        if (hasDifferences) {
          // Delta-Buchungen: Nur die ÄNDERUNG seit der letzten Buchung buchen
          const lines = await this.linesRepository.find({
            where: { session: { id: sessionId }, vehicle: { id: targetVehicleId } },
            relations: ['item', 'vehicle'],
          });

          for (const diff of differenceResult.differences) {
            const line = lines.find((l) => l.id === diff.lineId);
            if (!line) continue;

            const currentDelta = diff.delta; // Aktuelle Differenz
            const bookedDelta = line.bookedDelta ?? 0; // Bereits gebuchte Differenz (0 wenn noch nicht gebucht)
            const deltaToBook = currentDelta - bookedDelta; // Nur die ÄNDERUNG buchen

            if (deltaToBook !== 0) {
              const quantity = Math.abs(deltaToBook);
              const type = deltaToBook > 0 ? "CHECKIN" : "CHECKOUT";

              await this.stockService.recordMovement({
                itemId: diff.itemId,
                vehicleId: diff.vehicleId!,
                type,
                quantity,
                occurredAt: new Date().toISOString(),
                note: `Inventur ${session.name}: Delta ${deltaToBook > 0 ? "+" : ""}${deltaToBook} (vorher: ${bookedDelta}, neu: ${currentDelta})`,
                source: `inventory:${session.id}:${line.id}`,
              });

              // Aktualisiere die gebuchte Differenz in der Line
              line.bookedDelta = currentDelta;
              await this.linesRepository.save(line);
            }
          }
          differencesApplied = true;
          vehicleStatus.adjustmentsApplied = true;
        }
      }

      vehicleStatus.status = InventoryVehicleStatusState.SUBMITTED;
      vehicleStatus.submittedBy = username;
      vehicleStatus.submittedAt = new Date();
      await this.vehicleStatusRepository.save(vehicleStatus);

      await this.sessionsRepository.save(session);

      // User für Logging holen
      const user = await this.usersRepository.findOne({ where: { username } });

      await this.loggingService.log(
        LogLevel.INFO,
        LogCategory.INVENTORY,
        "inventory_vehicle_submitted",
        JSON.stringify({
          sessionId,
          sessionName: session.name,
          vehicleId: targetVehicleId,
          clientChecksum,
          serverChecksum,
          applyAdjustments,
          differencesApplied,
          differenceCount,
          deltaSum,
        }),
        { userId: user?.id ?? undefined },
      );

      return session;
    }

    // Legacy: kompletter Session-Submit (Manager/Warehouse)
    session.status = InventorySessionStatus.SUBMITTED;
    session.submittedBy = username;
    session.submittedAt = new Date();

    const saved = await this.sessionsRepository.save(session);

    // Optional: automatische Buchung der Differenzen durch Techniker
    let differencesApplied = false;
    let differenceCount = 0;
    let deltaSum = 0;

    if (applyAdjustments) {
      // SELECT FOR UPDATE verhindert Doppelbuchung bei parallelen Requests.
      await this.dataSource.transaction(async (manager) => {
        const lockedSession = await manager.findOne(InventorySession, {
          where: { id: sessionId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedSession || lockedSession.adjustmentsApplied) {
          return; // bereits verarbeitet – stille Idempotenz
        }

        const differenceResult = await this.getSessionDifferences(sessionId);
        differenceCount = differenceResult.differences.length;
        deltaSum = differenceResult.totals.deltaSum;

        if (differenceCount > 0) {
          const unbuchbar = differenceResult.differences.some((diff) => !diff.vehicleId && !diff.locationId);
          if (unbuchbar) {
            throw new BadRequestException(
              "Differenzen ohne Fahrzeug und ohne Lagerort können nicht automatisch gebucht werden.",
            );
          }

          for (const diff of differenceResult.differences) {
            const quantity = Math.abs(diff.delta);
            const type = diff.delta > 0 ? "CHECKIN" : "CHECKOUT";

            await this.stockService.recordMovement({
              itemId: diff.itemId,
              vehicleId: diff.vehicleId ?? undefined,
              locationId: diff.locationId ?? undefined,
              type,
              quantity,
              occurredAt: new Date().toISOString(),
              note: `Inventur ${session.name}: Delta ${diff.delta > 0 ? "+" : ""}${diff.delta}`,
              source: `inventory:${session.id}`,
            });
          }

          differencesApplied = true;
          lockedSession.adjustmentsApplied = true;
          await manager.save(InventorySession, lockedSession);
        }
      });
    }

    // User für Logging holen
    const user = await this.usersRepository.findOne({ where: { username } });

    // Audit-Log
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.INVENTORY,
      "inventory_session_submitted",
      JSON.stringify({
        sessionId,
        sessionName: session.name,
        linesCount: session.lines.length,
        clientChecksum,
        serverChecksum,
        checksumMatch: clientChecksum === serverChecksum,
        applyAdjustments,
        differencesApplied,
        differenceCount,
        deltaSum,
      }),
      { userId: user?.id ?? undefined },
    );

    return saved;
  }

  /**
   * Manager: Setzt Session zurück auf DRAFT (für Korrekturen/Nacharbeiten)
   * Erlaubt Wiedereröffnung von SUBMITTED und FINALIZED Sessions
   */
  async reopenSession(sessionId: string, username: string, branchId?: string | null) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId),
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    if (session.status === InventorySessionStatus.DRAFT) {
      throw new ConflictException("Session ist bereits im DRAFT-Status.");
    }

    const previousStatus = session.status;

    session.status = InventorySessionStatus.DRAFT;
    session.submittedBy = null;
    session.submittedAt = null;
    
    // Bei Wiedereröffnung von FINALIZED/CANCELLED: finalized/Checksums zurücksetzen
    if (previousStatus === InventorySessionStatus.FINALIZED || previousStatus === InventorySessionStatus.CANCELLED) {
      session.finalizedBy = null;
      session.finalizedAt = null;
      session.completedAt = null;
      session.clientChecksum = null;
      session.serverChecksum = null;
      session.adjustmentsApplied = false; // Buchungen zurücksetzen bei Wiedereröffnung
    }

    // Fahrzeug-Teilstatus zurücksetzen und Session-Status atomar speichern
    const vehicleStatuses = await this.vehicleStatusRepository.find({ where: { session: { id: sessionId } } });
    for (const vs of vehicleStatuses) {
      vs.status = InventoryVehicleStatusState.DRAFT;
      vs.submittedAt = null;
      vs.submittedBy = null;
      vs.adjustmentsApplied = false;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      if (vehicleStatuses.length > 0) {
        await manager.save(vehicleStatuses);
      }
      return manager.save(session);
    });

    // User für Logging holen
    const user = await this.usersRepository.findOne({ where: { username } });

    // Audit-Log
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.INVENTORY,
      "inventory_session_reopened",
      JSON.stringify({ 
        sessionId, 
        sessionName: session.name,
        previousStatus: previousStatus,
        reopenedBy: username
      }),
      { userId: user?.id ?? undefined },
    );

    return saved;
  }

  /**
   * Manager: Gibt ein einzelnes Fahrzeug in einer Session wieder fürei (SUBMITTED → DRAFT)
   * Setzt nur das spezifische Fahrzeug auf DRAFT, nicht alle
   */
  async reopenVehicle(sessionId: string, vehicleId: string, username: string, branchId?: string | null) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId),
      relations: ["vehicleStatuses", "lines", "lines.vehicle", "lines.item"],
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    const vehicleStatus = await this.vehicleStatusRepository.findOne({
      where: { session: { id: sessionId }, vehicle: { id: vehicleId } },
    });

    if (!vehicleStatus) {
      throw new NotFoundException(`Fahrzeugstatus für Inventur nicht gefunden`);
    }

    if (vehicleStatus.status === InventoryVehicleStatusState.DRAFT) {
      throw new ConflictException("Fahrzeug ist bereits im laufenden Status.");
    }

    const previousStatus = vehicleStatus.status;
    const previousSubmittedBy = vehicleStatus.submittedBy;

    // KRITISCH: Aktualisiere expectedQuantity für alle Lines dieses Fahrzeugs.
    // Die expectedQuantity muss der aktuellen Fahrzeug-Bestand sein (nach den Buchungen).
    const vehicleLines = session.lines.filter((line) => line.vehicle?.id === vehicleId);

    // Alle StockLevels für das Fahrzeug in einem Query laden (P-01: N+1 vermieden)
    const itemIds = vehicleLines.map((l) => l.item.id);
    const stockLevels = itemIds.length > 0
      ? await this.stockLevelsRepository.find({
          where: itemIds.map((itemId) => ({ item: { id: itemId }, vehicle: { id: vehicleId } })),
          relations: ["item"],
        })
      : [];
    const stockByItemId = new Map(stockLevels.map((sl) => [sl.item.id, sl.quantity]));

    // Fahrzeug auf DRAFT und Lines in einer Transaktion speichern (D-01)
    vehicleStatus.status = InventoryVehicleStatusState.DRAFT;
    vehicleStatus.submittedBy = null;
    vehicleStatus.submittedAt = null;
    // WICHTIG: adjustmentsApplied NICHT zurücksetzen! Delta-Buchungen merken sich die gebuchten Werte in inventory_lines.bookedDelta

    for (const line of vehicleLines) {
      line.expectedQuantity = stockByItemId.get(line.item.id) ?? 0;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(vehicleStatus);
      if (vehicleLines.length > 0) {
        await manager.save(vehicleLines);
      }
    });

    // User für Logging holen
    const user = await this.usersRepository.findOne({ where: { username } });

    // Audit-Log
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.INVENTORY,
      "inventory_vehicle_reopened",
      JSON.stringify({
        sessionId,
        sessionName: session.name,
        vehicleId,
        previousStatus,
        previousSubmittedBy,
        reopenedBy: username,
      }),
      { userId: user?.id ?? undefined },
    );

    return vehicleStatus;
  }

  /**
   * Manager: Finalisiert Session → FINALIZED (unveränderbar)
   * Validiert Checksum, setzt finalizedBy/At
   */
  async finalizeSession(sessionId: string, username: string, dto?: FinalizeInventoryDto, branchId?: string | null) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId),
      relations: ["lines", "lines.location"],
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    if (session.status === InventorySessionStatus.FINALIZED) {
      throw new ConflictException("Session ist bereits finalisiert.");
    }

    // Validierung: Session muss mindestens eine Zeile haben
    if (!session.lines || session.lines.length === 0) {
      throw new BadRequestException(
        "Session kann nicht finalisiert werden: Keine Zeilen vorhanden.",
      );
    }

    const clientChecksum = dto?.clientChecksum;
    const applyAdjustments = Boolean(dto?.applyAdjustments);

    const differenceResult = await this.getSessionDifferences(sessionId);
    const hasDifferences = differenceResult.differences.length > 0;

    // Prüfen, ob alle Fahrzeuge eingereicht sind (per-Fahrzeug-Status)
    const vehicleIdsInSession = Array.from(new Set((session.lines || []).map((l) => l.vehicle?.id).filter(Boolean))) as string[];
    if (vehicleIdsInSession.length > 0) {
      const vehicleStatuses = await this.vehicleStatusRepository.find({
        where: { session: { id: sessionId } },
        relations: ["vehicle"],
      });

      const notSubmitted = vehicleIdsInSession.filter((vid) => {
        const vs = vehicleStatuses.find((v) => v.vehicle?.id === vid);
        return !vs || vs.status !== InventoryVehicleStatusState.SUBMITTED;
      });

      if (notSubmitted.length > 0) {
        throw new ConflictException("Nicht alle Fahrzeuge wurden eingereicht. Bitte alle Fahrzeuge auf SUBMITTED setzen oder den Abschluss erzwingen, nachdem alle Techniker fertig sind.");
      }
    }

    if (applyAdjustments && hasDifferences) {
      const unbuchbar = differenceResult.differences.some((diff) => !diff.vehicleId && !diff.locationId);
      if (unbuchbar) {
        throw new BadRequestException(
          "Differenzen ohne Fahrzeug und ohne Lagerort können nicht automatisch gebucht werden.",
        );
      }
    }

    // Server-Checksum berechnen
    const serverChecksum = this.calculateSessionChecksum(session);

    // Optional: Checksum-Validierung (wenn Client mitschickt)
    let checksumMatch = true;
    if (clientChecksum) {
      checksumMatch = clientChecksum === serverChecksum;
    }

    // Differenz-Buchungen ZUERST — Session wird erst nach erfolgreichen Buchungen
    // auf FINALIZED gesetzt, damit bei Fehler kein inkonsistenter Zustand entsteht.
    if (applyAdjustments && hasDifferences) {
      const vehicleStatuses = await this.vehicleStatusRepository.find({
        where: { session: { id: sessionId } },
        relations: ["vehicle"],
      });

      for (const diff of differenceResult.differences) {
        const vs = vehicleStatuses.find((v) => v.vehicle?.id === diff.vehicleId);
        if (vs?.adjustmentsApplied) {
          continue;
        }

        const quantity = Math.abs(diff.delta);
        const type = diff.delta > 0 ? "CHECKIN" : "CHECKOUT";

        await this.stockService.recordMovement({
          itemId: diff.itemId,
          vehicleId: diff.vehicleId ?? undefined,
          locationId: diff.locationId ?? undefined,
          type,
          quantity,
          occurredAt: new Date().toISOString(),
          note: `Inventur ${session.name}: Delta ${diff.delta > 0 ? "+" : ""}${diff.delta}`,
          source: `inventory:${session.id}`,
        });

        if (vs) {
          vs.adjustmentsApplied = true;
          await this.vehicleStatusRepository.save(vs);
        }
      }

      session.adjustmentsApplied = true;
    }

    // Erst jetzt als FINALIZED speichern — alle Buchungen sind erfolgreich abgeschlossen
    session.status = InventorySessionStatus.FINALIZED;
    session.finalizedBy = username;
    session.finalizedAt = new Date();
    session.completedAt = new Date();
    session.clientChecksum = clientChecksum || session.clientChecksum;
    session.serverChecksum = serverChecksum;

    const saved = await this.sessionsRepository.save(session);

    // User für Logging holen
    const user = await this.usersRepository.findOne({ where: { username } });

    // Audit-Log
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.INVENTORY,
      "inventory_session_finalized",
      JSON.stringify({
        sessionId,
        sessionName: session.name,
        linesCount: session.lines.length,
        clientChecksum,
        serverChecksum,
        checksumMatch,
        applyAdjustments,
        differencesApplied: applyAdjustments && hasDifferences,
        differenceCount: differenceResult.differences.length,
        deltaSum: differenceResult.totals.deltaSum,
      }),
      { userId: user?.id ?? undefined },
    );

    return saved;
  }

  /**
   * Prüft, ob Session editierbar ist (nur DRAFT erlaubt Änderungen)
   */
  private async ensureSessionIsEditable(sessionId: string, branchId?: string | null) {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId) as any,
      select: ["id", "status"],
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }

    if (session.status !== InventorySessionStatus.DRAFT) {
      throw new ConflictException(
        `Session ist im Status ${session.status}. Nur DRAFT-Sessions können bearbeitet werden.`,
      );
    }
  }

  /**
   * Berechnet HMAC-SHA256 Checksum über Session-Metadaten und sortierte Lines.
   * Durch den HMAC-Schlüssel können gespeicherte Checksums nicht nachträglich
   * gefälscht werden — tamper-evident für GoBD-Revision.
   */
  private calculateSessionChecksum(session: InventorySession): string {
    const lines = (session.lines || [])
      .map((line) => ({
        itemId: line.item?.id || "",
        vehicleId: line.vehicle?.id || "",
        countedQuantity: line.countedQuantity,
        expectedQuantity: line.expectedQuantity,
        note: line.note || "",
      }))
      .sort((a, b) => {
        const itemCmp = a.itemId.localeCompare(b.itemId);
        return itemCmp !== 0 ? itemCmp : a.vehicleId.localeCompare(b.vehicleId);
      });

    const payload = {
      sessionId: session.id,
      name: session.name,
      location: session.location,
      startedAt: session.startedAt?.toISOString(),
      lines,
    };

    return createHmac("sha256", this.hmacSecret)
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  /**
   * Stellt sicher, dass ein Fahrzeug innerhalb einer Session editierbar ist (nicht SUBMITTED auf Fahrzeug-Ebene)
   */
  private async ensureVehicleEditable(sessionId: string, vehicleId?: string | null) {
    if (!vehicleId) {
      return;
    }

    const vehicleStatus = await this.vehicleStatusRepository.findOne({
      where: { session: { id: sessionId }, vehicle: { id: vehicleId } },
      relations: ["session", "vehicle"],
    });

    if (vehicleStatus && vehicleStatus.status === InventoryVehicleStatusState.SUBMITTED) {
      throw new ConflictException("Dieses Fahrzeug wurde bereits zur Prüfung eingereicht und kann nicht mehr bearbeitet werden.");
    }
  }

  /**
   * Holt oder erzeugt den Fahrzeug-Status für eine Session
   */
  private async getOrCreateVehicleStatus(session: InventorySession, vehicleId: string) {
    let vehicleStatus = await this.vehicleStatusRepository.findOne({
      where: { session: { id: session.id }, vehicle: { id: vehicleId } },
      relations: ["session", "vehicle"],
    });

    if (!vehicleStatus) {
      const vehicle = await this.vehiclesService.findOne(vehicleId);
      if (!vehicle) {
        throw new NotFoundException("Vehicle not found");
      }
      vehicleStatus = this.vehicleStatusRepository.create({
        session,
        vehicle,
        status: InventoryVehicleStatusState.DRAFT,
        submittedBy: null,
        submittedAt: null,
        adjustmentsApplied: false,
      });
      vehicleStatus = await this.vehicleStatusRepository.save(vehicleStatus);
    }

    return vehicleStatus;
  }

  /**
   * Liefert eine Inventur-Session mit allen benötigten Relationen für Exporte/Reports
   */
  async getSessionForExport(sessionId: string, branchId?: string | null): Promise<InventorySession> {
    const session = await this.sessionsRepository.findOne({
      where: this.sessionWhereForBranch(sessionId, branchId),
      relations: [
        "lines",
        "lines.item",
        "lines.vehicle",
      ],
    });

    if (!session) {
      throw new NotFoundException("Inventur-Session nicht gefunden");
    }
    return session;
  }
}

