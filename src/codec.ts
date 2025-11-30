import type { PgCodec } from "@dataplan/pg";
import type { SQL } from "pg-sql2";
import { sql } from "pg-sql2";
import { getGISTypeDetails } from "./utils";
import { validateGeoJSON } from "./validation";
import type { GISTypeDetails } from "./types";

/**
 * Creates a PgCodec for a PostGIS geometry or geography type.
 * 
 * This function creates a custom codec that handles conversion between
 * PostgreSQL geometry/geography types and JavaScript GeoJSON objects.
 * 
 * @param typeName - Either "geometry" or "geography"
 * @param typeModifier - PostgreSQL type modifier (from pg_attribute.atttypmod)
 * @param pgTypeOid - PostgreSQL type OID for the geometry/geography type
 * @returns A PgCodec configured for PostGIS types
 * 
 * @example
 * ```ts
 * const codec = createPostGISCodec("geometry", 1107460, "12345");
 * // Creates a codec for geometry(Point, 4326)
 * ```
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
  // Parse type modifier to get column constraints
  // -1 means unconstrained (any geometry type), treat as null
  let typeDetails: GISTypeDetails | null = null;
  if (typeModifier != null && typeModifier !== -1) {
    typeDetails = getGISTypeDetails(typeModifier);
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
      const geojson = JSON.parse(value);
      
      // Warn about large geometries (> 1MB serialized)
      const serializedSize = JSON.stringify(geojson).length;
      const oneMB = 1024 * 1024;
      if (serializedSize > oneMB) {
        console.warn(
          `Large geometry detected: ${Math.round(serializedSize / 1024)}KB serialized. ` +
          `This may impact query performance. Consider using ST_Simplify or ST_SimplifyPreserveTopology.`
        );
      }
      
      return geojson;
    } catch (e) {
      throw new Error(
        `Failed to parse GeoJSON from PostGIS: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  // toPg: Convert GeoJSON object to PostGIS geometry/geography
  // This will be used for mutations (inserts/updates)
  // Returns a JSON string that will be used with ST_GeomFromGeoJSON in SQL
  const toPg = (value: any): string => {
    if (value === null || value === undefined) {
      // Null is handled separately by sqlValueWithCodec
      throw new Error("toPg should not be called with null/undefined");
    }

    // Validate GeoJSON structure
    const validationErrors = validateGeoJSON(value);
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((err) => `${err.field}: ${err.message}`)
        .join("; ");
      throw new Error(
        `Invalid GeoJSON: ${errorMessages}. ` +
          `Please provide valid GeoJSON according to RFC 7946 specification.`
      );
    }

    // Check if type matches column constraint (if any)
    if (typeDetails && typeDetails.subtype !== 0) {
      // Column has a specific geometry type constraint
      const expectedTypes: Record<number, string> = {
        1: "Point",
        2: "LineString",
        3: "Polygon",
        4: "MultiPoint",
        5: "MultiLineString",
        6: "MultiPolygon",
        7: "GeometryCollection",
      };
      const expectedType = expectedTypes[typeDetails.subtype];
      if (expectedType && value.type !== expectedType) {
        throw new Error(
          `GeoJSON type mismatch: column expects '${expectedType}', but received '${value.type}'. ` +
            `Please provide GeoJSON with type '${expectedType}'.`
        );
      }
    }

    // Extract SRID from GeoJSON if present (RFC 7946 doesn't include SRID, but some implementations do)
    // For now, we'll assume GeoJSON coordinates are in the column's SRID
    // SRID transformation will be handled by PostGIS if needed

    // Return JSON string - this will be used with ST_GeomFromGeoJSON in SQL
    // The actual SQL generation will wrap this with ST_GeomFromGeoJSON
    return JSON.stringify(value);
  };

  // Create codec object directly (t function is not exported from @dataplan/pg)
  const codec = {
    name: typeName,
    sqlType: sql.identifier(...typeName.split(".")),
    fromPg,
    toPg,
    attributes: undefined,
    extensions: {
      oid: pgTypeOid,
      // Mark this as a PostGIS codec for mutation handling
      isPostGIS: true,
      typeName,
      typeDetails,
    },
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
  > & {
    extensions: {
      oid: string | undefined;
      isPostGIS: true;
      typeName: typeof typeName;
      typeDetails: GISTypeDetails | null;
    };
  };

  return codec;
}

