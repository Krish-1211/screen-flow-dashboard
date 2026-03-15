import axios from 'axios';

export class HeartbeatSystem {
  private deviceId: string;
  private serverUrl: string;
  private interval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(deviceId: string, serverUrl: string, intervalSeconds: number = 30) {
    this.deviceId = deviceId;
    this.serverUrl = serverUrl;
    this.interval = intervalSeconds * 1000;
  }

  start() {
    this.send();
    this.timer = setInterval(() => this.send(), this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async send() {
    try {
      await axios.post(`${this.serverUrl}/screens/heartbeat`, {
        device_id: this.deviceId
      });
      // console.log('Heartbeat sent');
    } catch (e) {
      console.error('Heartbeat failed:', (e as any).message);
    }
  }
}
