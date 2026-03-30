declare const io: typeof import('socket.io-client').io;
declare namespace SocketIOClient {
  type Socket = import('socket.io-client').Socket;
}
