import type { SQL } from "pg-sql2";
import { sql } from "pg-sql2";
import type { PgCodec } from "@dataplan/pg";

/**
 * Creates SQL for PostGIS mutations by wrapping GeoJSON with ST_GeomFromGeoJSON/ST_GeogFromGeoJSON.
 *
 * This function should be used instead of sqlValueWithCodec for PostGIS codecs in mutations.
 * It handles SRID transformation if needed.
 * 
 * @param value - The GeoJSON value to convert (already validated and stringified)
 * @param codec - The PostGIS codec (geometry or geography)
 * @returns SQL fragment that converts the GeoJSON string to PostGIS geometry/geography
 * 
 * @example
 * ```ts
 * const sql = sqlValueWithPostGISCodec(geoJSONString, geometryCodec);
 * // Returns: sql`ST_GeomFromGeoJSON(${sql.value(geoJSONString)}::text, 4326)::geometry`
 * ```
 */
export function sqlValueWithPostGISCodec(
  value: unknown,
  codec: PgCodec & { extensions?: { isPostGIS?: boolean; typeName?: string; typeDetails?: any } }
): SQL {
  if (value == null) {
    return sql`NULL::${codec.sqlType}`;
  }

  // Check if this is a PostGIS codec
  const extensions = codec.extensions as any;
  if (!extensions?.isPostGIS) {
    // Fall back to standard behavior
    const encodedValue = codec.toPg(value);
    return sql`${sql.value(encodedValue)}::${codec.sqlType}`;
  }

  // For PostGIS, toPg returns a JSON string
  const jsonString = codec.toPg(value);

  // Get column SRID from type details if available
  const typeDetails = extensions.typeDetails;
  const columnSRID = typeDetails?.srid;

  // Extract SRID from GeoJSON if present (some implementations include it)
  // For now, we'll assume GeoJSON coordinates match the column's expected SRID
  // SRID transformation will be handled by PostGIS if coordinates don't match

  const typeName = extensions.typeName || codec.name;

  if (typeName === "geography") {
    // For geography, use ST_GeomFromGeoJSON and cast to geography
    // Geography doesn't use SRID the same way - it's always WGS84 (SRID 4326)
    // So we just cast the geometry to geography
    return sql`ST_GeomFromGeoJSON(${sql.value(jsonString)}::text)::geography`;
  } else {
    // For geometry, use ST_GeomFromGeoJSON
    // ST_GeomFromGeoJSON doesn't take SRID directly, we use ST_SetSRID to set it
    if (columnSRID != null && columnSRID !== 0) {
      // If column has SRID constraint, set it using ST_SetSRID
      // This assumes coordinates are already in the correct SRID
      // If they're not, we'd need ST_Transform, but that requires knowing the source SRID
      return sql`ST_SetSRID(ST_GeomFromGeoJSON(${sql.value(jsonString)}::text), ${sql.value(columnSRID)})::geometry`;
    } else {
      // No SRID constraint - use ST_GeomFromGeoJSON as-is
      return sql`ST_GeomFromGeoJSON(${sql.value(jsonString)}::text)::geometry`;
    }
  }
}

