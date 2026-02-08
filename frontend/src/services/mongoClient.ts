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

if (!globalForMongo._mongoClient) {
  globalForMongo._mongoClient = new MongoClient(MONGODB_URI);
  globalForMongo._mongoClientPromise = globalForMongo._mongoClient.connect();
}

export const clientPromise: Promise<MongoClient> =
  globalForMongo._mongoClientPromise!;
