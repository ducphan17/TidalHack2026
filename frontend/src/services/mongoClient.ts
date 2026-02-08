import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

// Cache client across Next.js hot reloads in dev
const globalForMongo = globalThis as unknown as {
  _mongoClient?: MongoClient;
  _mongoClientPromise?: Promise<MongoClient>;
};

function createClient(): Promise<MongoClient> {
  const client = new MongoClient(MONGODB_URI!, {
    tls: true,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
  });

  const promise = client.connect().catch((err) => {
    // If connection fails, clear the cache so the next request retries
    console.error("[MongoDB] Connection failed, will retry on next request:", err.message);
    globalForMongo._mongoClient = undefined;
    globalForMongo._mongoClientPromise = undefined;
    throw err;
  });

  globalForMongo._mongoClient = client;
  globalForMongo._mongoClientPromise = promise;

  return promise;
}

if (!globalForMongo._mongoClientPromise) {
  createClient();
}

export const clientPromise: Promise<MongoClient> =
  globalForMongo._mongoClientPromise ?? createClient();
