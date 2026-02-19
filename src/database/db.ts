import { drizzle } from "drizzle-orm/node-postgres"

// Validate DATABASE_URL environment variable exists
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL environment variable is required but not defined. Please check your .env.local file."
    )
}

export const db = drizzle(databaseUrl)
