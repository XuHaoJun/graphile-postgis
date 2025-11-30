import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { SQL } from "pg-sql2";
import type { PgCodec } from "@dataplan/pg";
import { sqlValueWithPostGISCodec } from "./mutationUtils";

const { version } = require("../package.json");

/**
 * Plugin to handle PostGIS mutations by wrapping GeoJSON values with ST_GeomFromGeoJSON/ST_GeogFromGeoJSON
 * 
 * This plugin overrides sqlValueWithCodec in the build object to handle PostGIS codecs specially.
 * When a PostGIS codec is used in mutations, it wraps the GeoJSON JSON string with the appropriate
 * PostGIS function call.
 */
export const PostgisMutationPlugin: GraphileConfig.Plugin = {
  name: "PostgisMutationPlugin",
  version,
  after: ["PostgisCodecPlugin", "PostgisTypesPlugin"],

  schema: {
    hooks: {
      build(build) {
        const { lib } = build;
        const dataplanPg = (lib as any).dataplanPg;
        if (!dataplanPg) {
          console.warn("PostgisMutationPlugin: dataplanPg not found in build.lib");
          return build;
        }
        const { sqlValueWithCodec: originalSqlValueWithCodec } = dataplanPg;

        // Override sqlValueWithCodec to handle PostGIS codecs
        // Check if codec is PostGIS and use special handling
        const customSqlValueWithCodec = EXPORTABLE(
          (originalSqlValueWithCodec, sqlValueWithPostGISCodec) =>
            function sqlValueWithCodec(value: unknown, codec: PgCodec): SQL {
              // Check if this is a PostGIS codec
              const extensions = (codec.extensions as any);
              if (extensions?.isPostGIS) {
                return sqlValueWithPostGISCodec(value, codec);
              }
              // Fall back to original behavior for non-PostGIS codecs
              return originalSqlValueWithCodec(value, codec);
            },
          [originalSqlValueWithCodec, sqlValueWithPostGISCodec]
        );

        // Replace sqlValueWithCodec in dataplanPg using defineProperty to override getter
        try {
          Object.defineProperty(dataplanPg, "sqlValueWithCodec", {
            value: customSqlValueWithCodec,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch (e) {
          // If defineProperty fails, try direct assignment (may fail if property is read-only)
          console.warn(
            "PostgisMutationPlugin: Could not override sqlValueWithCodec using defineProperty, trying direct assignment"
          );
          try {
            (dataplanPg as any).sqlValueWithCodec = customSqlValueWithCodec;
          } catch (e2) {
            console.error(
              "PostgisMutationPlugin: Failed to override sqlValueWithCodec. Mutations may not work correctly.",
              e2
            );
          }
        }

        return build;
      },
    },
  },
};

