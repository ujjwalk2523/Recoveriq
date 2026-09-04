import IORedis from 'ioredis';
import { getEnvConfig } from '../config/env';
import { logger, redactSecret } from '../observability/logger';

export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number; px?: number; nx?: boolean }): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string, options?: { limit?: { offset: number; count: number } }): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zcard(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  hset(key: string, fieldOrRecord: string | Record<string, string>, value?: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  ping(): Promise<string>;
  eval(script: string, numkeys: number, ...keysAndArgs: (string | number)[]): Promise<any>;
  disconnect(): Promise<void>;
  isReady(): boolean;
}

/**
 * In-process, high-fidelity Redis adapter for deterministic testing and zero-dependency local dev.
 */
export class InMemoryRedisClient implements IRedisClient {
  private kv = new Map<string, { val: string; exp?: number }>();
  private lists = new Map<string, string[]>();
  private sortedSets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, string>>();
  private connected = true;

  private checkExpiry(key: string): boolean {
    const item = this.kv.get(key);
    if (item && item.exp && Date.now() > item.exp) {
      this.kv.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) throw new Error('Redis connection is closed');
    this.checkExpiry(key);
    const item = this.kv.get(key);
    return item ? item.val : null;
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; nx?: boolean }
  ): Promise<'OK' | null> {
    if (!this.connected) throw new Error('Redis connection is closed');
    this.checkExpiry(key);

    if (options?.nx && this.kv.has(key)) {
      return null;
    }

    let exp: number | undefined;
    if (options?.ex) exp = Date.now() + options.ex * 1000;
    if (options?.px) exp = Date.now() + options.px;

    this.kv.set(key, { val: value, exp });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    let count = 0;
    for (const k of keys) {
      if (this.kv.delete(k)) count++;
      if (this.lists.delete(k)) count++;
      if (this.sortedSets.delete(k)) count++;
      if (this.sets.delete(k)) count++;
      if (this.hashes.delete(k)) count++;
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    this.checkExpiry(key);
    return this.kv.has(key) || this.lists.has(key) || this.sortedSets.has(key) || this.sets.has(key) || this.hashes.has(key)
      ? 1
      : 0;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const list = this.lists.get(key) || [];
    list.push(...values);
    this.lists.set(key, list);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    const item = list.shift()!;
    return item;
  }

  async llen(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const list = this.lists.get(key) || [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    let zset = this.sortedSets.get(key);
    if (!zset) {
      zset = new Map<string, number>();
      this.sortedSets.set(key, zset);
    }
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    const minScore = min === '-inf' ? -Infinity : Number(min);
    const maxScore = max === '+inf' ? Infinity : Number(max);

    const matches: { member: string; score: number }[] = [];
    for (const [member, score] of zset.entries()) {
      if (score >= minScore && score <= maxScore) {
        matches.push({ member, score });
      }
    }

    matches.sort((a, b) => a.score - b.score);
    let results = matches.map((m) => m.member);

    if (options?.limit) {
      results = results.slice(options.limit.offset, options.limit.offset + options.limit.count);
    }

    return results;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;
    let count = 0;
    for (const m of members) {
      if (zset.delete(m)) count++;
    }
    return count;
  }

  async zcard(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const zset = this.sortedSets.get(key);
    return zset ? zset.size : 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    let set = this.sets.get(key);
    if (!set) {
      set = new Set<string>();
      this.sets.set(key, set);
    }
    let count = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        count++;
      }
    }
    return count;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const set = this.sets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const m of members) {
      if (set.delete(m)) count++;
    }
    return count;
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async hset(key: string, fieldOrRecord: string | Record<string, string>, value?: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }

    let added = 0;
    if (typeof fieldOrRecord === 'object') {
      for (const [f, v] of Object.entries(fieldOrRecord)) {
        if (!hash.has(f)) added++;
        hash.set(f, v);
      }
    } else if (typeof fieldOrRecord === 'string' && value !== undefined) {
      if (!hash.has(fieldOrRecord)) added++;
      hash.set(fieldOrRecord, value);
    }

    return added;
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const hash = this.hashes.get(key);
    if (!hash || !hash.has(field)) return null;
    return hash.get(field)!;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const res: Record<string, string> = {};
    for (const [k, v] of hash.entries()) {
      res[k] = v;
    }
    return res;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.pexpire(key, seconds * 1000);
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const item = this.kv.get(key);
    if (item) {
      item.exp = Date.now() + milliseconds;
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    if (!this.connected) throw new Error('Redis connection is closed');
    const item = this.kv.get(key);
    if (!item || !item.exp) return -1;
    const remainingMs = item.exp - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Redis connection is closed');
    return 'PONG';
  }

  async eval(script: string, numkeys: number, ...keysAndArgs: (string | number)[]): Promise<any> {
    if (!this.connected) throw new Error('Redis connection is closed');

    // Common Redis script: Atomic lock release
    // if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end
    if (script.includes('redis.call("get", KEYS[1]) == ARGV[1]')) {
      const key = String(keysAndArgs[0]);
      const token = String(keysAndArgs[1]);
      const current = await this.get(key);
      if (current === token) {
        await this.del(key);
        return 1;
      }
      return 0;
    }

    // Common Redis script: Atomic claim from ready queue with lease set
    if (script.includes('lpop') && script.includes('set')) {
      const queueKey = String(keysAndArgs[0]);
      const jobId = await this.lpop(queueKey);
      return jobId;
    }

    return 1;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isReady(): boolean {
    return this.connected;
  }

  simulateDisconnect(): void {
    this.connected = false;
  }

  simulateReconnect(): void {
    this.connected = true;
  }

  clear(): void {
    this.kv.clear();
    this.lists.clear();
    this.sortedSets.clear();
    this.sets.clear();
    this.hashes.clear();
  }
}

/**
 * Production Redis client adapter backed by ioredis with Upstash TLS support
 */
export class RealIORedisAdapter implements IRedisClient {
  private client: IORedis;

  constructor(url: string) {
    this.client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: false,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });

    this.client.on('error', (err) => {
      logger.warn('[Redis] Client connection warning:', { error: err?.message });
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; nx?: boolean }
  ): Promise<'OK' | null> {
    const args: any[] = [key, value];
    if (options?.ex) {
      args.push('EX', options.ex);
    } else if (options?.px) {
      args.push('PX', options.px);
    }
    if (options?.nx) {
      args.push('NX');
    }
    const res = await (this.client.set as any)(...args);
    return res === 'OK' ? 'OK' : null;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    return this.client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const res = await this.client.zadd(key, score, member);
    return typeof res === 'number' ? res : Number(res);
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    if (options?.limit) {
      return this.client.zrangebyscore(key, min, max, 'LIMIT', options.limit.offset, options.limit.count);
    }
    return this.client.zrangebyscore(key, min, max);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.client.zrem(key, ...members);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async hset(key: string, fieldOrRecord: string | Record<string, string>, value?: string): Promise<number> {
    if (typeof fieldOrRecord === 'object') {
      const res = await this.client.hset(key, fieldOrRecord);
      return typeof res === 'number' ? res : Number(res);
    }
    const res = await this.client.hset(key, fieldOrRecord, value!);
    return typeof res === 'number' ? res : Number(res);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return this.client.pexpire(key, milliseconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async eval(script: string, numkeys: number, ...keysAndArgs: (string | number)[]): Promise<any> {
    return this.client.eval(script, numkeys, ...keysAndArgs);
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  isReady(): boolean {
    return this.client.status === 'ready' || this.client.status === 'connect';
  }
}

// Global singleton instance
let redisInstance: IRedisClient | null = null;

export function getRedisClient(): IRedisClient {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL;
    const isMock = !redisUrl || redisUrl.includes('localhost') || process.env.USE_IN_MEMORY_REDIS === 'true' || process.env.NODE_ENV === 'test';

    if (!isMock && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
      try {
        redisInstance = new RealIORedisAdapter(redisUrl);
      } catch (err) {
        logger.warn('[Redis] Falling back to InMemoryRedisClient:', { error: err });
        redisInstance = new InMemoryRedisClient();
      }
    } else {
      redisInstance = new InMemoryRedisClient();
    }
  }
  return redisInstance;
}

export function setRedisClientForTesting(client: IRedisClient | null): void {
  redisInstance = client;
}

