import SqliteDatabase from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';
import config from '../config';

export class Database {
  private db: SqliteDatabase.Database | null = null;
  private isInitialized: boolean = false;
  private dbPath: string;

  constructor() {
    this.dbPath = path.resolve(config.databaseUrl);
    try {
      this.db = new SqliteDatabase(this.dbPath);
      this.setupPragmas();
      logger.info('数据库连接成功', { path: this.dbPath });
    } catch (err: any) {
      logger.error('数据库连接失败', { path: this.dbPath, error: err.message });
      throw err;
    }
  }

  private setupPragmas(): void {
    if (!this.db) return;
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 30000');
    this.db.pragma('synchronous = NORMAL');
  }

  /**
   * 初始化数据库（验证连接）
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.verifyConnection();
      this.isInitialized = true;
      logger.info('数据库初始化完成');
    } catch (error) {
      logger.error('数据库初始化失败', { error });
      throw error;
    }
  }

  /**
   * 验证数据库连接
   */
  private verifyConnection(): void {
    try {
      this.db?.prepare('SELECT 1 as test').get();
      logger.debug('数据库连接验证成功');
    } catch (error: any) {
      logger.error('数据库连接验证失败', { error: error.message });
      throw new Error('数据库连接验证失败');
    }
  }

  /**
   * 查询单行
   */
  async get(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error('数据库连接未初始化');
    }
    return this.db.prepare(sql).get(...params);
  }

  /**
   * 查询多行
   */
  async all(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('数据库连接未初始化');
    }
    return this.db.prepare(sql).all(...params);
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      logger.info('数据库连接已关闭');
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * 检查表是否存在
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [tableName]
      );
      return !!result;
    } catch (error) {
      logger.error('检查表是否存在失败', { tableName, error });
      return false;
    }
  }

  /**
   * 获取数据库信息
   */
  async getDatabaseInfo(): Promise<{
    tables: string[];
    version: string;
    size: number;
  }> {
    try {
      const tables = await this.all(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );

      const versionResult = await this.get('SELECT sqlite_version() as version');

      // 获取数据库文件大小
      const pageCountResult = await this.get('PRAGMA page_count');
      const pageSizeResult = await this.get('PRAGMA page_size');

      const pageCount = pageCountResult ? Object.values(pageCountResult)[0] as number : 0;
      const pageSize = pageSizeResult ? Object.values(pageSizeResult)[0] as number : 0;
      const size = pageCount * pageSize;

      return {
        tables: tables.map((table: any) => table.name),
        version: versionResult?.version || 'unknown',
        size
      };
    } catch (error) {
      logger.error('获取数据库信息失败', { error });
      throw error;
    }
  }
}

// 创建数据库实例
export const database = new Database();