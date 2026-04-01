import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { Observable } from 'rxjs';

type RealtimeEventPayload = Record<string, unknown>;

export type RealtimeEvent = {
  id: string;
  type: string;
  occurredAt: string;
  payload: RealtimeEventPayload;
  originId: string;
};

type RealtimeSubscriber = (event: RealtimeEvent) => void;

type RedisClientRole = 'publisher' | 'subscriber';

type RedisErrorState = {
  message: string;
  lastLoggedAt: number;
  suppressedCount: number;
};

const REDIS_ERROR_LOG_WINDOW_MS = 30_000;

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly instanceId = crypto.randomUUID();
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly subscribers = new Map<
    string,
    Map<string, RealtimeSubscriber>
  >();
  private readonly redisErrors = new Map<RedisClientRole, RedisErrorState>();

  constructor(private readonly configService: ConfigService) {
    const redisOptions: RedisOptions = {
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 1_000, 5_000),
    };

    this.publisher = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);
    this.bindRedisClient('publisher', this.publisher);
    this.bindRedisClient('subscriber', this.subscriber);
  }

  async onModuleInit() {
    this.subscriber.on('message', (channel, message) => {
      const userId = this.parseUserIdFromChannel(channel);
      if (!userId) {
        return;
      }

      try {
        const event = JSON.parse(message) as RealtimeEvent;
        if (event.originId === this.instanceId) {
          return;
        }
        this.dispatchToLocalSubscribers(userId, event);
      } catch (error) {
        this.logger.warn(
          `Failed to process realtime message for ${channel}: ${String(error)}`,
        );
      }
    });

    const [publisherConnected, subscriberConnected] = await Promise.all([
      this.connectClient(this.publisher, 'publisher'),
      this.connectClient(this.subscriber, 'subscriber'),
    ]);

    if (publisherConnected && subscriberConnected) {
      this.logger.log('Realtime service initialized.');
      return;
    }

    this.logger.warn(
      'Realtime service initialized without Redis. Cross-instance realtime delivery will resume automatically when Redis is reachable again.',
    );
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }

  createUserStream(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subscriptionId = crypto.randomUUID();
      const emit = (event: RealtimeEvent) => {
        subscriber.next({
          data: event,
          id: event.id,
        });
      };

      this.logger.debug(
        `Opening realtime stream for user ${userId} with subscription ${subscriptionId}`,
      );
      this.addLocalSubscriber(userId, subscriptionId, emit);
      void this.ensureChannelSubscription(userId);

      emit(
        this.createEvent('system.connected', {
          userId,
        }),
      );

      const heartbeat = setInterval(() => {
        emit(
          this.createEvent('system.heartbeat', {
            userId,
          }),
        );
      }, 25000);

      return () => {
        clearInterval(heartbeat);
        this.logger.debug(
          `Closing realtime stream for user ${userId} with subscription ${subscriptionId}`,
        );
        void this.removeLocalSubscriber(userId, subscriptionId);
      };
    });
  }

  async publishToUser(
    userId: string,
    type: string,
    payload: RealtimeEventPayload,
  ) {
    const event = this.createEvent(type, payload);
    this.logger.debug(`Publishing realtime event ${type} to user ${userId}`);
    this.dispatchToLocalSubscribers(userId, event);

    if (!this.isRedisReady(this.publisher)) {
      return;
    }

    try {
      await this.publisher.publish(
        this.getUserChannel(userId),
        JSON.stringify(event),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish realtime event to ${userId}: ${String(error)}`,
      );
    }
  }

  async publishToUsers(
    userIds: string[],
    type: string,
    payload: RealtimeEventPayload,
  ) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    await Promise.all(
      uniqueIds.map((userId) => this.publishToUser(userId, type, payload)),
    );
  }

  private createEvent(
    type: string,
    payload: RealtimeEventPayload,
  ): RealtimeEvent {
    return {
      id: crypto.randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      payload,
      originId: this.instanceId,
    };
  }

  private getUserChannel(userId: string) {
    return `realtime:user:${userId}`;
  }

  private parseUserIdFromChannel(channel: string) {
    return channel.startsWith('realtime:user:')
      ? channel.slice('realtime:user:'.length)
      : null;
  }

  private async ensureChannelSubscription(userId: string) {
    const channel = this.getUserChannel(userId);
    const currentCount = this.subscribers.get(userId)?.size ?? 0;

    if (currentCount === 1) {
      if (!this.isRedisReady(this.subscriber)) {
        return;
      }

      try {
        await this.subscriber.subscribe(channel);
      } catch (error) {
        this.logger.warn(
          `Failed to subscribe realtime channel for ${userId}: ${String(error)}`,
        );
      }
    }
  }

  private async removeLocalSubscriber(userId: string, subscriptionId: string) {
    const userSubscribers = this.subscribers.get(userId);
    if (!userSubscribers) {
      return;
    }

    userSubscribers.delete(subscriptionId);
    if (userSubscribers.size > 0) {
      return;
    }

    this.subscribers.delete(userId);
    if (!this.isRedisReady(this.subscriber)) {
      return;
    }

    try {
      await this.subscriber.unsubscribe(this.getUserChannel(userId));
    } catch (error) {
      this.logger.warn(
        `Failed to unsubscribe realtime channel for ${userId}: ${String(error)}`,
      );
    }
  }

  private addLocalSubscriber(
    userId: string,
    subscriptionId: string,
    handler: RealtimeSubscriber,
  ) {
    const userSubscribers =
      this.subscribers.get(userId) ?? new Map<string, RealtimeSubscriber>();
    userSubscribers.set(subscriptionId, handler);
    this.subscribers.set(userId, userSubscribers);
  }

  private dispatchToLocalSubscribers(userId: string, event: RealtimeEvent) {
    const userSubscribers = this.subscribers.get(userId);
    if (!userSubscribers?.size) {
      return;
    }

    for (const handler of userSubscribers.values()) {
      handler(event);
    }
  }

  private bindRedisClient(role: RedisClientRole, client: Redis) {
    client.on('error', (error) => {
      this.logRedisError(role, error);
    });

    client.on('ready', () => {
      this.flushRedisErrors(role);
      this.logger.log(`Realtime ${role} Redis connection ready.`);

      if (role === 'subscriber') {
        void this.restoreSubscriptions();
      }
    });
  }

  private async connectClient(client: Redis, role: RedisClientRole) {
    if (this.isRedisReady(client)) {
      return true;
    }

    if (client.status !== 'wait') {
      return false;
    }

    try {
      await client.connect();
      return true;
    } catch (error) {
      this.logger.warn(
        `Realtime ${role} Redis unavailable at startup: ${String(error)}`,
      );
      return false;
    }
  }

  private isRedisReady(client: Redis) {
    return client.status === 'ready' || client.status === 'connect';
  }

  private async restoreSubscriptions() {
    if (!this.isRedisReady(this.subscriber)) {
      return;
    }

    const channels = Array.from(this.subscribers.keys(), (userId) =>
      this.getUserChannel(userId),
    );

    if (!channels.length) {
      return;
    }

    try {
      await this.subscriber.subscribe(...channels);
    } catch (error) {
      this.logger.warn(
        `Failed to restore realtime subscriptions: ${String(error)}`,
      );
    }
  }

  private logRedisError(role: RedisClientRole, error: unknown) {
    const message = String(error);
    const current = this.redisErrors.get(role);
    const now = Date.now();

    if (
      current &&
      current.message === message &&
      now - current.lastLoggedAt < REDIS_ERROR_LOG_WINDOW_MS
    ) {
      current.suppressedCount += 1;
      return;
    }

    if (current?.suppressedCount) {
      this.logger.warn(
        `Suppressed ${current.suppressedCount} repeated realtime ${role} Redis errors: ${current.message}`,
      );
    }

    this.redisErrors.set(role, {
      message,
      lastLoggedAt: now,
      suppressedCount: 0,
    });
    this.logger.error(`Realtime ${role} error: ${message}`);
  }

  private flushRedisErrors(role: RedisClientRole) {
    const current = this.redisErrors.get(role);
    if (!current) {
      return;
    }

    if (current.suppressedCount) {
      this.logger.warn(
        `Suppressed ${current.suppressedCount} repeated realtime ${role} Redis errors: ${current.message}`,
      );
    }

    this.redisErrors.delete(role);
  }
}
