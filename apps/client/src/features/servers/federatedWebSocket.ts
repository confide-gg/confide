import { BaseWebSocket } from "../../core/network/BaseWebSocket";

export interface WsMember {
  id: string;
  username: string;
  kem_public_key: number[];
}

export class FederatedWebSocketService extends BaseWebSocket<any, any> {
  private domain: string;
  private token: string;

  constructor(domain: string, token: string) {
    super();
    this.domain = domain;
    this.token = token;
  }

  protected getUrl(): string {
    const protocol = this.domain.includes("localhost") ? "ws" : "wss";
    const host = this.domain.replace(/^https?:\/\//, "");
    return `${protocol}://${host}/ws?token=${this.token}`;
  }

  protected onOpen(): void {
    console.log(`Connected to federated server: ${this.domain}`);
  }

  protected onClose(): void {
    console.log(`Disconnected from federated server: ${this.domain}`);
  }

  public subscribeChannel(channelId: string) {
    this.send({ type: "subscribe_channel", channel_id: channelId });
  }

  public unsubscribeChannel(channelId: string) {
    this.send({ type: "unsubscribe_channel", channel_id: channelId });
  }

  public sendTyping(channelId: string) {
    this.send({ type: "typing_start", channel_id: channelId });
  }

  public sendStopTyping(channelId: string) {
    this.send({ type: "typing_stop", channel_id: channelId });
  }
}
