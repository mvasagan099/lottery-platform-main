import { FastifyRequest, FastifyReply } from 'fastify';

// Track connected users
export const connectedClients = new Map<string, any>();

export class LiveChatController {
  static handleConnection(socket: any, request: FastifyRequest) {
    // The inherited admin preHandler authenticates the upgrade request.
    const userId = request.user.userId;

    connectedClients.set(userId, socket);

    socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'TYPING') {
          // Broadcast typing to the agent/user
          const recipientId = data.ticketId; // We would look up assigned agent
          // For simplicity, we just log
        }
        
        if (data.type === 'MESSAGE') {
          // We could save message to DB here and broadcast it
          // Broadcast to recipient
        }
      } catch (err) {
        console.error('Invalid message format', err);
      }
    });

    socket.on('close', () => {
      if (connectedClients.get(userId) === socket) connectedClients.delete(userId);
    });
  }

  static broadcastToUser(userId: string, data: any) {
    const conn = connectedClients.get(userId);
    if (conn) {
      conn.send(JSON.stringify(data));
    }
  }
}
