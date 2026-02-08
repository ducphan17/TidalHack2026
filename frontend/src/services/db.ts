import { type Db } from "mongodb";
import { clientPromise } from "./mongoClient";

const DB_NAME = "tidalhack";

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}
