import Database from 'better-sqlite3';
import { join, resolve, isAbsolute } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { logger } from '../utils/logger';
import { dirname } from 'path';

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    if (process.env.WALLET_DB_PATH) {
      this.dbPath = isAbsolute(process.env.WALLET_DB_PATH)
        ? process.env.WALLET_DB_PATH
        : resolve(process.cwd(), process.env.WALLET_DB_PATH);
    } else {
      this.dbPath = resolve(process.cwd(), 'wallet.db');
    }
  }

  async connect(): Promise<void> {
    try {
      const dbDir = dirname(this.dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(this.dbPath, {
        verbose: (message: any) => logger.debug(String(message))
      });
      logger.info('Database connected successfully', { path: this.dbPath });

      this.setupPragmas();
      this.initDatabase();
    } catch (err: any) {
      logger.error('Database connection failed', { path: this.dbPath, error: err.message });
      throw err;
    }
  }

  private setupPragmas(): void {
    if (!this.db) return;

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 30000');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
  }

  private initDatabase(): void {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      logger.info('开始初始化数据库表...');
      const potentialPaths = [
        resolve(process.cwd(), 'src/db/schema.sql'),
        resolve(__dirname, '../db/schema.sql'),
        resolve(process.cwd(), 'sql/schema.sql'),
        resolve(__dirname, '../../sql/schema.sql'),
        resolve(__dirname, '../../../sql/schema.sql')
      ];

      let finalSchemaPath = '';
      for (const p of potentialPaths) {
        if (existsSync(p)) {
          finalSchemaPath = p;
          break;
        }
      }

      if (!finalSchemaPath) {
        throw new Error(`找不到 schema.sql, 尝试了: ${potentialPaths.join(', ')}`);
      }

      const schemaSql = readFileSync(finalSchemaPath, 'utf-8');
      this.db.exec(schemaSql);
      logger.info('数据库表初始化完成');
    } catch (error) {
      logger.error('数据库表初始化失败', { error });
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec(sql);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.prepare(sql).all(...params) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID: number | bigint; changes: number }> {
    if (!this.db) throw new Error('Database not connected');
    const result = this.db.prepare(sql).run(...params);
    return {
      lastID: result.lastInsertRowid,
      changes: result.changes
    };
  }

  async beginTransaction(): Promise<void> {
    await this.exec('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    await this.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.exec('ROLLBACK');
  }

  async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not connected');

    // better-sqlite3 has a .transaction() but to keep it simple and async-compatible:
    await this.beginTransaction();
    try {
      const result = await operation();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }
}