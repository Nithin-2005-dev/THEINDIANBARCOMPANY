import "server-only"

import { Db, MongoClient } from "mongodb"

const DEFAULT_DB_NAME = "theindianbar"

declare global {
  var __tibMongoClientPromise: Promise<MongoClient> | undefined
}

function createMongoClientPromise(uri: string) {
  return new MongoClient(uri).connect()
}

export function getMongoDatabaseName() {
  return process.env.MONGODB_DB?.trim() || DEFAULT_DB_NAME
}

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI?.trim()

  if (!uri) {
    return null
  }

  if (!global.__tibMongoClientPromise) {
    global.__tibMongoClientPromise = createMongoClientPromise(uri)
  }

  return global.__tibMongoClientPromise
}

export async function getMongoDb(): Promise<Db | null> {
  const client = await getMongoClient()

  if (!client) {
    return null
  }

  return client.db(getMongoDatabaseName())
}
