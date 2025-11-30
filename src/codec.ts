import type { PgCodec } from "@dataplan/pg";
import type { SQL } from "pg-sql2";
import { sql } from "pg-sql2";
import { getGISTypeDetails } from "./utils";

/**
 * Creates a PgCodec for a PostGIS geometry or geography type
 */
export function createPostGISCodec(
  typeName: "geometry" | "geography",
  typeModifier: number | null | undefined,
  pgTypeOid: string | undefined
): PgCodec<
  typeof typeName,
  undefined,
  string,
  any, // GeoJSON object
  undefined,
  undefined,
  undefined
> {
  // Parse type modifier if available (for future use)
  if (typeModifier != null) {
    getGISTypeDetails(typeModifier);
  }

  // castFromPg: Generate SQL to convert geometry/geography to GeoJSON
  const castFromPg = (fragment: SQL): SQL => {
    // Use ST_AsGeoJSON to convert geometry/geography to GeoJSON text
    // The result will be a JSON string that we'll parse in fromPg
    return sql`ST_AsGeoJSON(${fragment})::text`;
  };

  // fromPg: Parse the GeoJSON JSON string returned from Postgres
  const fromPg = (value: string | null): any => {
    if (value === null) {
      return null;
    }
    try {
      // ST_AsGeoJSON returns a JSON string, parse it
      return JSON.parse(value);
    } catch (e) {
      throw new Error(
        `Failed to parse GeoJSON from PostGIS: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  // toPg: Convert GeoJSON object to PostGIS geometry/geography
  // This will be used for mutations (inserts/updates)
  const toPg = (value: any): string => {
    if (value === null || value === undefined) {
      return "NULL";
    }
    // For now, we'll use ST_GeomFromGeoJSON
    // In mutations, we'll need to handle SRID transformation
    // This is a placeholder - actual implementation will be in the mutation handler
    return JSON.stringify(value);
  };

  // Create codec object directly (t function is not exported from @dataplan/pg)
  return {
    name: typeName,
    sqlType: sql.identifier(...typeName.split(".")),
    fromPg,
    toPg,
    attributes: undefined,
    extensions: { oid: pgTypeOid },
    castFromPg,
    listCastFromPg: undefined,
    executor: null,
    isBinary: false,
    isEnum: false,
    hasNaturalOrdering: false,
    hasNaturalEquality: false,
  } as PgCodec<
    typeof typeName,
    undefined,
    string,
    any,
    undefined,
    undefined,
    undefined
  >;
}

