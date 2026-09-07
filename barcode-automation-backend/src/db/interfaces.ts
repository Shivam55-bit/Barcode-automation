/**
 * Industrial BarcodeFlow Enterprise Database Provider Interfaces
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseProvider {
  /**
   * Initializes database connection and executes migrations
   */
  initialize(): void;

  /**
   * Executes a DDL/DML statement without returning rows
   */
  execute(sql: string, params?: any[]): void;

  /**
   * Executes a parameterized query returning an array of objects
   */
  query<T = any>(sql: string, params?: any[]): T[];

  /**
   * Executes a query returning a single row or null
   */
  queryOne<T = any>(sql: string, params?: any[]): T | null;

  /**
   * Reads an entire named collection (compatible with legacy JSON models)
   */
  readCollection<T = any>(collectionName: string, fallback?: T[]): T[];

  /**
   * Replaces or writes an entire named collection
   */
  writeCollection<T = any>(collectionName: string, items: T[]): boolean;

  /**
   * Upserts a single item in a collection by ID
   */
  upsertItem<T extends { id: string }>(collectionName: string, item: T): boolean;

  /**
   * Deletes a single item by ID from a collection
   */
  deleteItem(collectionName: string, id: string): boolean;

  /**
   * Closes database connection cleanly
   */
  close(): void;
}
