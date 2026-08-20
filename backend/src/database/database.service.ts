import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      this.logger.warn('DATABASE_URL not configured. Operating in in-memory fallback mode.');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
      });

      const client = await this.pool.connect();
      this.isConnected = true;
      this.logger.log('✅ Connected to PostgreSQL Database (Supabase)');
      client.release();

      await this.initializeSchema();
    } catch (err: any) {
      this.logger.warn(`PostgreSQL connection failed (${err.message}). Using resilient in-memory vector storage.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async query(text: string, params: any[] = []): Promise<QueryResult<any> | null> {
    if (!this.isConnected || !this.pool) {
      return null;
    }
    try {
      return await this.pool.query(text, params);
    } catch (err: any) {
      this.logger.error(`Database query error: ${err.message}`);
      return null;
    }
  }

  get isDbAvailable(): boolean {
    return this.isConnected;
  }

  private async initializeSchema() {
    if (!this.pool) return;
    try {
      // 1. Try enabling pgvector extension
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
      this.logger.log('✅ pgvector extension enabled');
    } catch (e: any) {
      this.logger.warn(`pgvector extension note: ${e.message}`);
    }

    try {
      // 2. Create memory_entries table with 384-dim vector
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS memory_entries (
          id UUID PRIMARY KEY,
          request_id VARCHAR(255),
          request_text TEXT,
          agent_used VARCHAR(50),
          output TEXT,
          decision VARCHAR(50),
          edited_content TEXT,
          embedding vector(384),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.logger.log('✅ memory_entries table ready with vector(384)');
    } catch (err: any) {
      // If vector datatype not directly supported, fallback to json/float array table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS memory_entries (
          id UUID PRIMARY KEY,
          request_id VARCHAR(255),
          request_text TEXT,
          agent_used VARCHAR(50),
          output TEXT,
          decision VARCHAR(50),
          edited_content TEXT,
          embedding TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.logger.log('✅ memory_entries table ready with text/float embedding');
    }
  }
}
