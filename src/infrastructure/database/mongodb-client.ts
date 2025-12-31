/**
 * MongoDB Client - Connection Management
 * Handles MongoDB connection lifecycle and provides access to database
 */

import { MongoClient, Db } from 'mongodb';

export class MongoDBClient {
  private client: MongoClient;
  private db: Db | null = null;
  private isConnected: boolean = false;

  constructor(private connectionUri: string, private dbName: string = 'ar_tracker') {
    this.client = new MongoClient(this.connectionUri);
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('MongoDB: Already connected');
      return;
    }

    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      console.log(`MongoDB: Connected to database "${this.dbName}"`);

      // Create indexes
      await this.createIndexes();
    } catch (error) {
      console.error('MongoDB: Connection failed', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.close();
      this.isConnected = false;
      this.db = null;
      console.log('MongoDB: Disconnected');
    } catch (error) {
      console.error('MongoDB: Disconnect failed', error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB: Not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get MongoDB client (for transactions)
   */
  getClient(): MongoClient {
    return this.client;
  }

  /**
   * Check if connected
   */
  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Create indexes for collections
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('MongoDB: Creating indexes...');

      // Events collection indexes
      const eventsCollection = this.db.collection('events');
      await eventsCollection.createIndex({ event_id: 1 }, { unique: true });
      await eventsCollection.createIndex({ ar_id: 1, timestamp: 1 });
      await eventsCollection.createIndex({ event_type: 1, timestamp: -1 });
      await eventsCollection.createIndex({ created_at: 1 });

      // AR State collection indexes
      const arStateCollection = this.db.collection('ar_state');
      await arStateCollection.createIndex({ ar_id: 1 }, { unique: true });
      await arStateCollection.createIndex({ customer_id: 1 });
      await arStateCollection.createIndex({ current_status: 1, due_date: 1 });
      await arStateCollection.createIndex({ due_date: 1 });
      await arStateCollection.createIndex({ assigned_sales_id: 1 });

      // Alert Queue collection indexes
      const alertQueueCollection = this.db.collection('alert_queue');
      await alertQueueCollection.createIndex({ alert_id: 1 }, { unique: true });
      await alertQueueCollection.createIndex({ status: 1, scheduled_for: 1 });
      await alertQueueCollection.createIndex({ ar_id: 1, created_at: -1 });
      await alertQueueCollection.createIndex({ 'delivery_address.chat_id': 1 });

      console.log('MongoDB: Indexes created successfully');
    } catch (error) {
      // Log but don't throw - indexes might already exist
      console.warn('MongoDB: Index creation warning (may already exist)', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error('MongoDB: Health check failed', error);
      return false;
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
let mongoDBClient: MongoDBClient | null = null;

export function getMongoDBClient(uri?: string, dbName?: string): MongoDBClient {
  if (!mongoDBClient) {
    if (!uri) {
      throw new Error('MongoDB URI required for first initialization');
    }
    mongoDBClient = new MongoDBClient(uri, dbName);
  }
  return mongoDBClient;
}

export function resetMongoDBClient(): void {
  mongoDBClient = null;
}
