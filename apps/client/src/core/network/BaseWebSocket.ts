
export type BaseMessageHandler<T = any> = (message: T) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Event) => void;

export abstract class BaseWebSocket<IncomingMessageType, OutgoingMessageType> {
    protected ws: WebSocket | null = null;
    protected messageHandlers: Set<BaseMessageHandler<IncomingMessageType>> = new Set();
    protected connectHandlers: Set<ConnectionHandler> = new Set();
    protected disconnectHandlers: Set<ConnectionHandler> = new Set();
    protected errorHandlers: Set<ErrorHandler> = new Set();

    protected reconnectAttempts = 0;
    protected maxReconnectAttempts = 5;
    protected reconnectDelay = 1000;
    protected maxReconnectDelay = 30000;
    protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    protected intentionalDisconnect = false;
    protected isConnecting = false;

    protected pingInterval: ReturnType<typeof setInterval> | null = null;
    protected pingIntervalMs = 30000; // Default 30s
    protected shouldPing = false;

    constructor() { }

    /**
     * Implement this to return the full WebSocket URL
     */
    protected abstract getUrl(): string | Promise<string>;

    /**
     * Optional hook called after connection is established
     */
    protected onConnected(): void { }

    /**
     * Optional hook for ping logic
     */
    protected getPingMessage(): OutgoingMessageType | null {
        return null;
    }

    private connectPromise: Promise<void> | null = null;

    public async connect(): Promise<void> {
        if (this.connectPromise) {
            return this.connectPromise;
        }

        if (this.ws?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        this.connectPromise = this._doConnect();
        try {
            await this.connectPromise;
        } finally {
            this.connectPromise = null;
        }
    }

    private async _doConnect(): Promise<void> {
        if (this.isConnecting) {
            return;
        }

        if (this.ws?.readyState === WebSocket.CLOSING) {
            await new Promise(resolve => setTimeout(resolve, 200));
            if (this.ws?.readyState === WebSocket.CLOSING) {
                return;
            }
        }

        this.isConnecting = true;
        this.intentionalDisconnect = false;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();

        try {
            const url = await this.getUrl();
            if (!url) {
                this.isConnecting = false;
                return;
            }

            if (this.ws) {
                this.resetWsListeners(this.ws);
                if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close();
                }
                await new Promise(resolve => setTimeout(resolve, 50));
                this.ws = null;
            }

            return new Promise<void>((resolve) => {
                this.ws = new WebSocket(url);
                let settled = false;

                this.ws.onopen = () => {
                    settled = true;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startPing();
                    this.onConnected();
                    this.connectHandlers.forEach((h) => h());
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data) as IncomingMessageType;
                        this.handleMessage(message);
                    } catch (error) {
                        console.error(`[WS] Parse error:`, error);
                        this.errorHandlers.forEach((h) => h(error as Event));
                    }
                };

                this.ws.onclose = (event) => {
                    this.isConnecting = false;
                    this.stopPing();
                    this.disconnectHandlers.forEach((h) => h());

                    if (event.code === 1008 || event.code === 4401) {
                        console.error('[WS] Authentication failed or token expired');
                        this.intentionalDisconnect = true;
                        if (!settled) {
                            settled = true;
                            resolve();
                        }
                        return;
                    }

                    if (!this.intentionalDisconnect) {
                        this.attemptReconnect();
                    }
                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                };

                this.ws.onerror = (error) => {
                    this.isConnecting = false;
                    console.error(`[WS] Error:`, error);
                    this.errorHandlers.forEach((h) => h(error));
                    if (!settled && this.ws?.readyState !== WebSocket.OPEN) {
                        this.attemptReconnect();
                    }
                };
            });

        } catch (err) {
            this.isConnecting = false;
            console.error(`[WS] Connection failed:`, err);
            this.attemptReconnect();
        }
    }

    public disconnect() {
        this.intentionalDisconnect = true;
        this.isConnecting = false;
        this.clearReconnectTimer();
        this.stopPing();

        if (this.ws) {
            const currentWs = this.ws;
            this.ws = null;
            this.resetWsListeners(currentWs);
            currentWs.close();
            this.disconnectHandlers.forEach((h) => h());
        }
    }

    private resetWsListeners(ws: WebSocket) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.onopen = null;
    }

    public reset() {
        this.disconnect();
        this.intentionalDisconnect = false;
        this.reconnectAttempts = 0;
    }

    public send(data: OutgoingMessageType) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    // --- Event Subscription ---

    public onMessage(handler: BaseMessageHandler<IncomingMessageType>): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    public onConnect(handler: ConnectionHandler): () => void {
        this.connectHandlers.add(handler);
        return () => this.connectHandlers.delete(handler);
    }

    public onDisconnect(handler: ConnectionHandler): () => void {
        this.disconnectHandlers.add(handler);
        return () => this.disconnectHandlers.delete(handler);
    }

    public onError(handler: ErrorHandler): () => void {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    // --- Internals ---

    private handleMessage(message: IncomingMessageType) {
        this.messageHandlers.forEach((h) => h(message));
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[WS] Max reconnects reached`);
            this.errorHandlers.forEach((h) => h(new Event('MaxReconnectsReached') as Event));
            return;
        }

        const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        const jitter = Math.random() * baseDelay * 0.5;
        const delay = Math.min(baseDelay + jitter, this.maxReconnectDelay);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    protected startPing() {
        this.stopPing();
        if (this.shouldPing) {
            this.pingInterval = setInterval(() => {
                const pingMsg = this.getPingMessage();
                if (pingMsg) this.send(pingMsg);
            }, this.pingIntervalMs);
        }
    }

    protected stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
