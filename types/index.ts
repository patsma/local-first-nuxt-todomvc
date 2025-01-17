import type { RxDocument, RxCollection, RxDatabase } from 'rxdb';

// Document type for pushups
export interface PushupDocType {
  id: string;
  pushupCount: number;
  state: 'open' | 'done';
  lastChange: number;
  createdBy: string;
  timestamp: number;
}

// Methods that can be added to documents
export interface PushupDocMethods {
  // Add any document methods here if needed
}

// Collection methods
export interface PushupCollectionMethods {
  // Add any collection methods here if needed
}

// Define the document type with methods
export type PushupDocument = RxDocument<PushupDocType, PushupDocMethods>;

// Define the collection type
export type PushupCollection = RxCollection<
  PushupDocType,
  PushupDocMethods,
  PushupCollectionMethods
>;

// Define the database collections
export interface DatabaseCollections {
  pushups: PushupCollection;
}

// Define the full database type
export type PushupDatabase = RxDatabase<DatabaseCollections>;
