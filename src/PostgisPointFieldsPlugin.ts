import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add x, y, z, and srid fields to Point geometry columns
 * 
 * This plugin detects PostGIS Point geometry/geography columns and adds
 * coordinate fields (x/longitude, y/latitude, z/height, srid) that use
 * PostGIS functions (ST_X, ST_Y, ST_Z, ST_SRID) to extract values directly
 * from the geometry without parsing GeoJSON.
 */
export const PostgisPointFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisPointFieldsPlugin",
  version,
  after: ["PostgisTypesPlugin", "PgAttributesPlugin"],

  schema: {
    hooks: {
      GraphQLObjectType_fields(fields, build, context) {
        const {
          scope,
          fieldWithHooks,
        } = context;

        // Type guard for object fields context
        const objectScope = scope as any;
        const isPgClassType = objectScope.isPgClassType;
        const pgCodec = objectScope.pgCodec;

        // Only process table types with attributes
        if (!isPgClassType || !pgCodec?.attributes) {
          return fields;
        }

        const { inflection, graphql } = build;
        const sqlLib = (build.lib as any).sql || require("pg-sql2").sql;
        const { GraphQLNonNull, GraphQLFloat, GraphQLInt } = graphql;

        // Check each attribute to see if it's a PostGIS Point geometry
        const newFields: Record<string, any> = {};

        // Get float8 and int4 codecs for coordinates and SRID
        const pgRegistry = (build.input as any).pgRegistry;
        if (!pgRegistry) {
          return fields;
        }
        const float8Codec = pgRegistry.pgCodecs?.float8;
        const int4Codec = pgRegistry.pgCodecs?.int4;
        if (!float8Codec || !int4Codec) {
          return fields; // Need these codecs
        }

        for (const [attributeName, attribute] of Object.entries(
          pgCodec.attributes
        )) {
          const attributeCodec = (attribute as any).codec;
          const extensions = (attributeCodec.extensions as any);

          // Check if this is a PostGIS codec
          if (!extensions?.isPostGIS) {
            continue;
          }

          // Get type details from codec extensions
          const typeDetails = extensions.typeDetails;
          if (!typeDetails) {
            // Unconstrained geometry - we can't determine if it's a Point
            continue;
          }

          // Only add fields for Point geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.Point) {
            continue;
          }

          const hasZ = typeDetails.hasZ;
          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });
          const xFieldName = (inflection as any).gisXFieldName(attributeCodec);
          const yFieldName = (inflection as any).gisYFieldName(attributeCodec);
          const zFieldName = (inflection as any).gisZFieldName(attributeCodec);

          // Add x field (longitude for geography, x for geometry)
          newFields[`${fieldName}_${xFieldName}`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_${xFieldName}`,
            } as any,
            {
              description: build.wrapDescription(
                `The ${xFieldName} coordinate of this Point geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(GraphQLFloat),
              plan: EXPORTABLE(
                (attributeName, sqlLib, float8Codec) =>
                  function plan($source: any) {
                    // $source is a PgSelectSingleStep
                    // Get the class step (PgSelectStep) which has the alias
                    const classStep = $source.getClassStep();
                    const alias = classStep.alias;
                    // Reference the geometry column directly and apply ST_X
                    return $source.select(
                      sqlLib`ST_X(${alias}.${sqlLib.identifier(attributeName)})`,
                      float8Codec
                    );
                  },
                [attributeName, sqlLib, float8Codec]
              ),
            }
          );

          // Add y field (latitude for geography, y for geometry)
          newFields[`${fieldName}_${yFieldName}`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_${yFieldName}`,
            } as any,
            {
              description: build.wrapDescription(
                `The ${yFieldName} coordinate of this Point geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(GraphQLFloat),
              plan: EXPORTABLE(
                (attributeName, sqlLib, float8Codec) =>
                  function plan($source: any) {
                    const classStep = $source.getClassStep();
                    const alias = classStep.alias;
                    return $source.select(
                      sqlLib`ST_Y(${alias}.${sqlLib.identifier(attributeName)})`,
                      float8Codec
                    );
                  },
                [attributeName, sqlLib, float8Codec]
              ),
            }
          );

          // Add z field if geometry has Z coordinate
          if (hasZ) {
            newFields[`${fieldName}_${zFieldName}`] = fieldWithHooks(
              {
                fieldName: `${fieldName}_${zFieldName}`,
              } as any,
              {
                description: build.wrapDescription(
                  `The ${zFieldName} coordinate of this Point geometry.`,
                  "field"
                ),
                type: new GraphQLNonNull(GraphQLFloat),
                plan: EXPORTABLE(
                  (attributeName, sqlLib, float8Codec) =>
                    function plan($source: any) {
                      const classStep = $source.getClassStep();
                      const alias = classStep.alias;
                      return $source.select(
                        sqlLib`ST_Z(${alias}.${sqlLib.identifier(attributeName)})`,
                        float8Codec
                      );
                    },
                  [attributeName, sqlLib, float8Codec]
                ),
              }
            );
          }

          // Add srid field
          newFields[`${fieldName}_srid`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_srid`,
            } as any,
            {
              description: build.wrapDescription(
                `The SRID (Spatial Reference System Identifier) of this Point geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(GraphQLInt),
              plan: EXPORTABLE(
                (attributeName, sqlLib, int4Codec) =>
                  function plan($source: any) {
                    const classStep = $source.getClassStep();
                    const alias = classStep.alias;
                    return $source.select(
                      sqlLib`ST_SRID(${alias}.${sqlLib.identifier(attributeName)})`,
                      int4Codec
                    );
                  },
                [attributeName, sqlLib, int4Codec]
              ),
            }
          );
        }

        if (Object.keys(newFields).length === 0) {
          return fields;
        }

        return build.extend(fields, newFields, "Adding PostGIS Point coordinate fields");
      },
    },
  },
};

