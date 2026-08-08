const BROADCAST_CHANNEL = "pediu_aqui_notifications";

export class TabCoordinator {
  private channel: BroadcastChannel;
  private isLeader: boolean = false;

  constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
    this.channel.onmessage = this.handleMessage.bind(this);
    // Simple leadership: first one wins for now
    this.claimLeadership();
  }

  private handleMessage(event: MessageEvent) {
    if (event.data.type === "HEARTBEAT") {
      // if we see another heartbeat, maybe yield leadership
    }
  }

  private claimLeadership() {
    this.isLeader = true;
    this.channel.postMessage({ type: "LEADER_CLAIM", timestamp: Date.now() });
  }

  notifyOthers(event: any) {
    this.channel.postMessage(event);
  }

  getIsLeader() {
    return this.isLeader;
  }
}

export const tabCoordinator = new TabCoordinator();
