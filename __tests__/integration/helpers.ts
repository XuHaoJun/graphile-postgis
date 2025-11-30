/**
 * Integration test helpers for PostGraphile schema creation and query execution.
 */

import * as pg from "pg";
import * as adaptor from "postgraphile/@dataplan/pg/adaptors/pg";
import type { GraphileConfig } from "graphile-config";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makeV4Preset, type V4Options } from "postgraphile/presets/v4";
import { makeSchema } from "postgraphile";
import { execute, hookArgs } from "grafast";
import { parse, validate, type ExecutionArgs } from "graphql";
import { makeWithPgClientViaPgClientAlreadyInTransaction } from "@dataplan/pg/adaptors/pg";
import { postgisPlugin } from "../../src/index";
import type { GraphQLSchema } from "graphql";
import { withPgClient } from "../helpers";

/**
 * Creates a PostGraphile schema with the PostGIS plugin enabled.
 */
export async function createPostGraphileSchema(
  pgPool: pg.Pool,
  schemas: string[],
  v4Options: V4Options = {},
  additionalPresets: GraphileConfig.Preset[] = []
): Promise<{ schema: GraphQLSchema; resolvedPreset: GraphileConfig.ResolvedPreset }> {
  const preset: GraphileConfig.Preset = {
    extends: [
      PostGraphileAmberPreset,
      postgisPlugin,
      makeV4Preset(v4Options),
      ...additionalPresets,
    ],
    pgServices: [
      adaptor.makePgService({
        name: "main",
        withPgClientKey: "withPgClient",
        pgSettingsKey: "pgSettings",
        schemas: schemas,
        pool: pgPool,
      }),
    ],
  };
  return await makeSchema(preset);
}

/**
 * Executes a GraphQL query against a PostGraphile schema.
 */
export async function executeGraphQLQuery(
  schema: GraphQLSchema,
  resolvedPreset: GraphileConfig.ResolvedPreset,
  query: string,
  variables?: Record<string, any>
): Promise<{ data: any; errors?: any[] }> {
  return withPgClient(async (pgClient) => {
    const document = parse(query);
    const validationErrors = validate(schema, document);
    if (validationErrors.length > 0) {
      throw new Error(
        `GraphQL validation errors:\n${validationErrors.map((e) => e.message).join("\n")}`
      );
    }

    const args: ExecutionArgs = {
      schema,
      document,
      variableValues: variables || {},
    };

    await hookArgs(args, resolvedPreset, {});

    const contextWithPgClient =
      makeWithPgClientViaPgClientAlreadyInTransaction(pgClient, false);
    try {
      args.contextValue = {
        pgSettings: (args.contextValue as any)?.pgSettings || {},
        withPgClient: contextWithPgClient,
      };

      const result = (await execute(args)) as any;
      return result;
    } finally {
      contextWithPgClient.release?.();
    }
  });
}

