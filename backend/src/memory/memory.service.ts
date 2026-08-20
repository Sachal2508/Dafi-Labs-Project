import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { MemoryEntry } from './entities/memory-entry.entity';

@Injectable()
export class MemoryService implements OnModuleInit {
  private readonly logger = new Logger(MemoryService.name);
  private pipeline: any = null;
  private readonly inMemoryStore: MemoryEntry[] = [];
  private isModelLoading = false;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    this.initEmbeddingPipeline().catch((err) => {
      this.logger.warn(`Deferred embedding model init: ${err.message}`);
    });
  }

  /**
   * Lazy load Xenova/all-MiniLM-L6-v2 model (384 dimension)
   */
  private async initEmbeddingPipeline() {
    if (this.pipeline || this.isModelLoading) return;
    this.isModelLoading = true;
    try {
      this.logger.log('Loading local embedding model: Xenova/all-MiniLM-L6-v2 (384 dims)...');
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.logger.log('✅ Xenova/all-MiniLM-L6-v2 local embedding model ready');
    } catch (err: any) {
      this.logger.warn(`Local transformers pipeline load warning: ${err.message}`);
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Generate 384-dimensional sentence embedding
   */
  async embed(text: string): Promise<number[]> {
    if (!this.pipeline) {
      await this.initEmbeddingPipeline();
    }

    if (this.pipeline) {
      try {
        const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      } catch (err: any) {
        this.logger.warn(`Embedding generation error: ${err.message}. Using deterministic vector.`);
      }
    }

    // Fallback deterministic 384-dim embedding if offline/loading
    return this.generateDeterministicEmbedding(text, 384);
  }

  /**
   * Store a completed human decision into RAG memory
   */
  async store(entry: {
    requestId: string;
    requestText: string;
    agentUsed: string;
    output: string;
    decision: 'approved' | 'edited' | 'rejected';
    editedContent?: string | null;
  }): Promise<MemoryEntry> {
    const memoryId = uuidv4();
    const targetTextForEmbedding = `Request: ${entry.requestText} | Deliverable: ${entry.editedContent || entry.output} | Human Decision: ${entry.decision}`;
    const embedding = await this.embed(targetTextForEmbedding);

    const record: MemoryEntry = {
      id: memoryId,
      requestId: entry.requestId,
      requestText: entry.requestText,
      agentUsed: entry.agentUsed,
      output: entry.output,
      decision: entry.decision,
      editedContent: entry.editedContent,
      embedding,
      createdAt: new Date().toISOString(),
    };

    // 1. Try storing in Postgres pgvector
    if (this.databaseService.isDbAvailable) {
      try {
        const vectorStr = `[${embedding.join(',')}]`;
        await this.databaseService.query(
          `INSERT INTO memory_entries (id, request_id, request_text, agent_used, output, decision, edited_content, embedding, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            record.id,
            record.requestId,
            record.requestText,
            record.agentUsed,
            record.output,
            record.decision,
            record.editedContent || null,
            vectorStr,
            record.createdAt,
          ],
        );
        this.logger.log(`[RAG Memory] Stored decision in Postgres pgvector: [${record.decision.toUpperCase()}] for "${entry.requestText.slice(0, 40)}..."`);
      } catch (e: any) {
        this.logger.warn(`Postgres memory insert error: ${e.message}`);
      }
    }

    // 2. Always persist in in-memory store for instant zero-latency retrieval
    this.inMemoryStore.push(record);
    return record;
  }

  /**
   * Retrieve top-k most relevant past human decisions for prompt augmentation
   */
  async retrieveSimilar(queryText: string, k = 3): Promise<MemoryEntry[]> {
    const queryEmbedding = await this.embed(queryText);

    // 1. If Postgres pgvector is available, query with cosine distance
    if (this.databaseService.isDbAvailable) {
      try {
        const vectorStr = `[${queryEmbedding.join(',')}]`;
        const res = await this.databaseService.query(
          `SELECT id, request_id, request_text, agent_used, output, decision, edited_content, created_at,
                  1 - (embedding <=> $1) as similarity
           FROM memory_entries
           ORDER BY embedding <=> $1
           LIMIT $2`,
          [vectorStr, k],
        );

        if (res && res.rows && res.rows.length > 0) {
          this.logger.log(`[RAG Retrieval] Found ${res.rows.length} relevant past decisions via pgvector`);
          return res.rows.map((row) => ({
            id: row.id,
            requestId: row.request_id,
            requestText: row.request_text,
            agentUsed: row.agent_used,
            output: row.output,
            decision: row.decision,
            editedContent: row.edited_content,
            createdAt: row.created_at,
            similarity: parseFloat(row.similarity),
          }));
        }
      } catch (e: any) {
        this.logger.warn(`pgvector query warning: ${e.message}. Falling back to in-memory cosine search.`);
      }
    }

    // 2. In-memory cosine similarity fallback
    this.logger.log(`[RAG Retrieval] Scanning ${this.inMemoryStore.length} entries in vector memory for query: "${queryText.slice(0, 40)}..."`);
    
    const scored = this.inMemoryStore.map((entry) => {
      const sim = this.cosineSimilarity(queryEmbedding, entry.embedding || []);
      return { ...entry, similarity: sim };
    });

    scored.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const topMatches = scored.slice(0, k);

    if (topMatches.length > 0) {
      this.logger.log(
        `[RAG Retrieval] In-memory cosine search found ${topMatches.length} matching decisions (Top sim: ${(topMatches[0].similarity || 0).toFixed(3)})`,
      );
    }

    return topMatches;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private generateDeterministicEmbedding(text: string, dim = 384): number[] {
    const vec = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const index = (code * 17 + i * 31) % dim;
      vec[index] += 1 / (i + 1);
    }
    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
