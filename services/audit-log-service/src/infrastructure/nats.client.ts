import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StreamConfig,
} from "nats";
import { envConfig } from "../config/env.config";
import { NATS_SUBJECTS, NATS_STREAMS } from "@transaction-system/shared";

export class NatsClient {
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await connect({
        servers: envConfig.nats.url,
        name: envConfig.service.name,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
      });

      console.log(`Connected to NATS at ${envConfig.nats.url}`);

      this.jetstream = this.connection.jetstream();
      this.jsm = await this.connection.jetstreamManager();

      await this.setupStreams();

      // Handle connection events
      (async () => {
        for await (const status of this.connection!.status()) {
          console.log(`NATS connection status: ${status.type}`);
        }
      })();
    } catch (error) {
      console.error("Failed to connect to NATS:", error);
      throw error;
    }
  }

  private async setupStreams(): Promise<void> {
    if (!this.jsm) {
      throw new Error("JetStream Manager not initialized");
    }

    try {
      // Setup Audit Logs Stream
      const auditStreamConfig: Partial<StreamConfig> = {
        name: NATS_STREAMS.AUDIT_LOGS,
        subjects: [
          NATS_SUBJECTS.AUDIT_LOG_CREATE,
          NATS_SUBJECTS.AUDIT_LOG_CREATED,
          NATS_SUBJECTS.AUDIT_LOG_FAILED,
          NATS_SUBJECTS.AUDIT_LOG_ROLLBACK,
        ],
        max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
      };

      try {
        await this.jsm.streams.info(NATS_STREAMS.AUDIT_LOGS);
        console.log(`Stream ${NATS_STREAMS.AUDIT_LOGS} already exists`);
      } catch {
        await this.jsm.streams.add(auditStreamConfig);
        console.log(`Created stream ${NATS_STREAMS.AUDIT_LOGS}`);
      }
    } catch (error) {
      console.error("Failed to setup streams:", error);
      throw error;
    }
  }

  async publish(subject: string, data: any): Promise<void> {
    if (!this.jetstream) {
      throw new Error("JetStream not initialized");
    }

    try {
      const payload = JSON.stringify(data);
      const ack = await this.jetstream.publish(
        subject,
        new TextEncoder().encode(payload)
      );
      console.log(`Published to ${subject}, seq: ${ack.seq}`);
    } catch (error) {
      console.error(`Failed to publish to ${subject}:`, error);
      throw error;
    }
  }

  async subscribe(
    subject: string,
    handler: (data: any) => Promise<void>
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("NATS connection not initialized");
    }

    try {
      const subscription = this.connection.subscribe(subject);

      (async () => {
        for await (const msg of subscription) {
          try {
            const data = JSON.parse(new TextDecoder().decode(msg.data));
            await handler(data);
          } catch (error) {
            console.error(`Error processing message from ${subject}:`, error);
          }
        }
      })();

      console.log(`Subscribed to ${subject}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${subject}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      console.log("NATS connection closed");
    }
  }

  getConnection(): NatsConnection {
    if (!this.connection) {
      throw new Error("NATS connection not initialized");
    }
    return this.connection;
  }

  getJetStream(): JetStreamClient {
    if (!this.jetstream) {
      throw new Error("JetStream not initialized");
    }
    return this.jetstream;
  }
}

export const natsClient = new NatsClient();
