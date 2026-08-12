import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { StockService } from './stock.service';

export interface QuickBookingEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  mode: 'CHECKOUT' | 'CHECKIN';
  locationId?: string;
  locationName?: string;
  reference?: string;
}

@WebSocketGateway({
  namespace: '/stock',
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
@Injectable()
export class StockGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(StockGateway.name);

  @WebSocketServer()
  server?: Server;

  // Speichert den aktuellen Buchungszustand pro User (userId → Liste)
  private readonly quickbookState = new Map<string, QuickBookingEntry[]>();

  constructor(private readonly stockService: StockService) {}

  handleConnection(client: Socket) {
    void client;
    const branchId: string | undefined = client.data?.user?.branchId;
    if (branchId) {
      void client.join('restock:' + branchId);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  // ── Restock ───────────────────────────────────────────────────────────────

  @SubscribeMessage('subscribeRestock')
  async handleSubscribeRestock(client: Socket) {
    const overview = await this.stockService.getRestockOverview({ status: 'OPEN' });
    client.emit('restockUpdate', overview);
  }

  broadcastRestockUpdate() {
    if (this.server) {
      this.server.emit('restock:updated', { refresh: true });
    } else {
      this.logger.warn('Kein Socket-Server verfuegbar, restock:updated nicht gesendet');
    }
  }

  // ── Schnellbuchung Echtzeit-Sync ──────────────────────────────────────────

  /** Gerät tritt dem Room des Users bei und erhält sofort den aktuellen Stand. */
  @SubscribeMessage('quickbook:join')
  async handleQuickbookJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data?.userId) return;
    const room = `quickbook:${data.userId}`;
    await client.join(room);
    const current = this.quickbookState.get(data.userId) ?? [];
    client.emit('quickbook:state', { list: current });
    this.logger.debug(`quickbook:join userId=${data.userId} socketId=${client.id}`);
  }

  /** Ein Gerät sendet die aktualisierte Liste → Server speichert und broadcastet. */
  @SubscribeMessage('quickbook:update')
  handleQuickbookUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; list: QuickBookingEntry[] },
  ) {
    if (!data?.userId) return;
    this.quickbookState.set(data.userId, data.list ?? []);
    const room = `quickbook:${data.userId}`;
    // Allen anderen Geräten im Room senden (excludes sender)
    client.to(room).emit('quickbook:state', { list: data.list ?? [] });
  }

  /** Buchung abgeschlossen – Liste auf allen Geräten leeren. */
  @SubscribeMessage('quickbook:booked')
  handleQuickbookBooked(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data?.userId) return;
    this.quickbookState.delete(data.userId);
    const room = `quickbook:${data.userId}`;
    client.to(room).emit('quickbook:booked');
  }

  /** Manuelles Löschen der Liste auf allen Geräten. */
  @SubscribeMessage('quickbook:clear')
  handleQuickbookClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data?.userId) return;
    this.quickbookState.delete(data.userId);
    const room = `quickbook:${data.userId}`;
    client.to(room).emit('quickbook:cleared');
  }

  /** Vorgangsnummer an alle anderen Geräte im Room übertragen. */
  @SubscribeMessage('quickbook:reference')
  handleQuickbookReference(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; reference: string },
  ) {
    if (!data?.userId) return;
    const room = `quickbook:${data.userId}`;
    client.to(room).emit('quickbook:reference', { reference: data.reference });
  }
}
