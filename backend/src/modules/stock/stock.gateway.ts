import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { StockService } from './stock.service';

@WebSocketGateway({ namespace: '/stock', cors: true })
@Injectable()
export class StockGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(StockGateway.name);

  @WebSocketServer()
  server?: Server;

  constructor(private readonly stockService: StockService) {}

  handleConnection(client: Socket) {
    void client;
    // Client connected
  }

  handleDisconnect(client: Socket) {
    void client;
    // Client disconnected
  }

  // Can be used for targeted updates
  @SubscribeMessage('subscribeRestock')
  async handleSubscribeRestock(client: Socket) {
    const overview = await this.stockService.getRestockOverview({ status: 'OPEN' });
    client.emit('restockUpdate', overview);
  }

  // Broadcast updates to all connected clients
  broadcastRestockUpdate() {
    void this.stockService.getRestockOverview({ status: 'OPEN' }).then((overview) => {
      if (this.server) {
        this.logger.debug(`restockUpdate gesendet (${overview.length} Requests)`);
        this.server.emit('restockUpdate', overview);
      } else {
        this.logger.warn('Kein Socket-Server verfuegbar, restockUpdate nicht gesendet');
      }
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      this.logger.error(`Fehler beim Senden von restockUpdate: ${message}`);
    });
  }
}
