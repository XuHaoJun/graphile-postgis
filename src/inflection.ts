import type { GraphileConfig } from "graphile-config";
import type { PgCodec } from "@dataplan/pg";
import { SUBTYPE_STRING_BY_SUBTYPE } from "./constants";
import type { Subtype } from "./types";

declare global {
  namespace GraphileBuild {
    interface Inflection {
      gisType(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>,
        subtype: Subtype,
        hasZ: boolean,
        hasM: boolean
      ): string;
      gisInterfaceName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisDimensionInterfaceName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>,
        hasZ: boolean,
        hasM: boolean
      ): string;
      geojsonFieldName(this: Inflection): string;
      gisXFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisYFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisZFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
    }
  }
}

export const PostgisInflectionPlugin: GraphileConfig.Plugin = {
  name: "PostgisInflectionPlugin",
  version: "0.1.0",

  inflection: {
    add: {
      gisType(_preset, codec, subtype, hasZ, hasM) {
        // Extract base type name (geometry or geography) from codec name
        // Codec names can be "geometry", "geography", or "geometry_point_4326", etc.
        let baseTypeName = codec.name;
        if (codec.name.startsWith("geography_")) {
          baseTypeName = "geography";
        } else if (codec.name.startsWith("geometry_")) {
          baseTypeName = "geometry";
        }
        
        // Special case: subtype 0 is generic "Geometry" - return just "Geometry" or "Geography"
        if (subtype === 0) {
          return baseTypeName === "geography" ? "Geography" : "Geometry";
        }
        
        // Always prefix with "Geometry" for geometry types to avoid conflicts with
        // built-in types like Point, LineString, etc. from graphile-build-pg
        // For geography, prefix with "Geography" to distinguish from geometry
        const subtypeString = SUBTYPE_STRING_BY_SUBTYPE[subtype];
        const parts = [];
        
        // Use "Geometry" prefix for geometry types, "Geography" for geography types
        // This generates "GeometryPoint", "GeometryLineString", etc.
        // and "GeographyPoint", "GeographyLineString", etc.
        // Exception: if subtype string already starts with "geometry" (like "geometry-collection"),
        // don't add the prefix to avoid "GeometryGeometryCollection"
        if (baseTypeName === "geography") {
          parts.push("geography");
        } else if (!subtypeString.startsWith("geometry")) {
          // For geometry, use "geometry" prefix only if subtype doesn't already include it
          parts.push("geometry");
        }
        
        parts.push(subtypeString);
        if (hasZ) parts.push("z");
        if (hasM) parts.push("m");
        
        return this.upperCamelCase(parts.join("-"));
      },
      gisInterfaceName(_preset, codec) {
        return this.upperCamelCase(`${codec.name}-interface`);
      },
      gisDimensionInterfaceName(_preset, codec, hasZ, hasM) {
        return this.upperCamelCase(
          [
            codec.name,
            SUBTYPE_STRING_BY_SUBTYPE[0],
            hasZ ? "z" : null,
            hasM ? "m" : null,
          ]
            .filter((x) => x !== null)
            .join("-")
        );
      },
      geojsonFieldName() {
        return `geojson`;
      },
      gisXFieldName(_preset, codec) {
        return codec.name === "geography" ? "longitude" : "x";
      },
      gisYFieldName(_preset, codec) {
        return codec.name === "geography" ? "latitude" : "y";
      },
      gisZFieldName(_preset, codec) {
        return codec.name === "geography" ? "height" : "z";
      },
    },
  },
};

