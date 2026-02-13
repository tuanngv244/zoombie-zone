import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../config/clientConfig';

/**
 * Singleton Socket.io wrapper for communicating with the Zombie Zone server.
 */
export class SocketClient {
  private static instance: SocketClient;
  private socket: Socket | null = null;
  private pendingListeners: Array<{ event: string; callback: (...args: any[]) => void }> = [];

  private constructor() {}

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  connect(): void {
    if (this.socket?.connected) return;
    if (this.socket) return; // already connecting

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Apply any listeners that were registered before connect()
    for (const { event, callback } of this.pendingListeners) {
      this.socket.on(event, callback);
    }
    this.pendingListeners = [];

    this.socket.on('connect', () => {
      console.log('[SocketClient] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketClient] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[SocketClient] Connection error:', err.message);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any): void {
    if (!this.socket) {
      console.warn('[SocketClient] Cannot emit, socket not created');
      return;
    }
    if (this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      // Queue emit until connected
      this.socket.once('connect', () => {
        this.socket?.emit(event, data);
      });
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      // Queue listener until connect() creates the socket
      this.pendingListeners.push({ event, callback });
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.removeAllListeners(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}
