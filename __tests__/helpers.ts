import * as pg from "pg";
import { parse, buildASTSchema, GraphQLSchema } from "graphql";
import { lexicographicSortSchema, printSchema } from "graphql/utilities";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Cannot run tests without a TEST_DATABASE_URL");
}

export const TEST_DATABASE_URL: string = process.env.TEST_DATABASE_URL;

/**
 * Creates a PostgreSQL connection pool and executes a callback with it.
 * The pool is automatically closed after the callback completes.
 */
export async function withPgPool<T>(
  cb: (pool: pg.Pool) => Promise<T>
): Promise<T> {
  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
  });
  try {
    return await cb(pool);
  } finally {
    await pool.end();
  }
}

/**
 * Gets a client from a PostgreSQL connection pool and executes a callback with it.
 * The client is automatically released after the callback completes.
 */
export async function withPgClient<T>(
  cb: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return withPgPool(async (pool) => {
    const client = await pool.connect();
    try {
      return await cb(client);
    } finally {
      client.release();
    }
  });
}

/**
 * Executes a callback within a database transaction.
 * The transaction is automatically rolled back after the callback completes.
 */
export async function withTransaction<T>(
  cb: (client: pg.PoolClient) => Promise<T>,
  closeCommand = "rollback"
): Promise<T> {
  return withPgClient(async (client) => {
    await client.query("begin");
    try {
      return await cb(client);
    } finally {
      await client.query(closeCommand);
    }
  });
}

/**
 * Prints a GraphQL schema in a consistent, ordered format.
 * Useful for snapshot testing.
 */
export function printSchemaOrdered(originalSchema: GraphQLSchema): string {
  // Clone schema so we don't damage anything
  const schema = buildASTSchema(parse(printSchema(originalSchema)));

  return printSchema(lexicographicSortSchema(schema));
}

