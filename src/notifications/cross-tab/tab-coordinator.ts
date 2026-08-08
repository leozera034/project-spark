const BROADCAST_CHANNEL = "pediu_aqui_notifications";

function messageType(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  return typeof value.type === "string" ? value.type : null;
}

export class TabCoordinator {
  private channel: BroadcastChannel;
  private isLeader = false;

  constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
    this.channel.onmessage = this.handleMessage.bind(this);
    // Simple leadership: first one wins for now
    this.claimLeadership();
  }

  private handleMessage(event: MessageEvent<unknown>) {
    if (messageType(event.data) === "HEARTBEAT") {
      // if we see another heartbeat, maybe yield leadership
    }
  }

  private claimLeadership() {
    this.isLeader = true;
    this.channel.postMessage({ type: "LEADER_CLAIM", timestamp: Date.now() });
  }

  notifyOthers(event: unknown) {
    this.channel.postMessage(event);
  }

  getIsLeader() {
    return this.isLeader;
  }
}

export const tabCoordinator = new TabCoordinator();
