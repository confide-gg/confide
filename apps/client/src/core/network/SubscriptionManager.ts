enum SubscriptionState {
  UNSUBSCRIBED = 'unsubscribed',
  PENDING = 'pending',
  ACTIVE = 'active',
  FAILED = 'failed',
}

export class SubscriptionManager {
  private subscriptions = new Map<string, {
    state: SubscriptionState;
    type: string;
  }>();

  subscribe(id: string, type: string): boolean {
    const current = this.subscriptions.get(id);

    if (current?.state === SubscriptionState.ACTIVE || current?.state === SubscriptionState.PENDING) {
      return false;
    }

    this.subscriptions.set(id, { state: SubscriptionState.PENDING, type });
    return true;
  }

  markActive(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub) sub.state = SubscriptionState.ACTIVE;
  }

  unsubscribe(id: string): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub || sub.state === SubscriptionState.UNSUBSCRIBED) return false;

    this.subscriptions.delete(id);
    return true;
  }

  onReconnect(sendFn: (id: string, type: string) => void): void {
    for (const [id, sub] of this.subscriptions) {
      if (sub.state === SubscriptionState.ACTIVE) {
        sub.state = SubscriptionState.PENDING;
        sendFn(id, sub.type);
      }
    }
  }

  clear(): void {
    this.subscriptions.clear();
  }
}
