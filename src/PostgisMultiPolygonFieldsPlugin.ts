import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add polygons array field to MultiPolygon geometry columns
 * 
 * This plugin detects PostGIS MultiPolygon geometry/geography columns and adds
 * a `polygons` field that returns an array of Polygon coordinate arrays (rings)
 * extracted from the MultiPolygon geometry.
 */
export const PostgisMultiPolygonFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisMultiPolygonFieldsPlugin",
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
        const { GraphQLList, GraphQLNonNull } = graphql;

        // Check each attribute to see if it's a PostGIS MultiPolygon geometry
        const newFields: Record<string, any> = {};

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
            // Unconstrained geometry - we can't determine if it's a MultiPolygon
            continue;
          }

          // Only add fields for MultiPolygon geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.MultiPolygon) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add polygons field - returns array of Polygon coordinate arrays (rings)
          // MultiPolygon GeoJSON format: { type: "MultiPolygon", coordinates: [[[exterior], [interior1]], [[exterior2], [interior2]], ...] }
          newFields[`${fieldName}_polygons`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_polygons`,
            } as any,
            {
              description: build.wrapDescription(
                `An array of Polygon coordinate arrays (rings) in this MultiPolygon geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(
                    new GraphQLList(
                      new GraphQLNonNull(
                        new GraphQLList(
                          new GraphQLNonNull(
                            new GraphQLList(
                              new GraphQLNonNull(graphql.GraphQLFloat)
                            )
                          )
                        )
                      )
                    )
                  )
                )
              ),
              plan: EXPORTABLE(
                (attributeName) =>
                  function plan($source: any) {
                    // Get the GeoJSON field for this attribute
                    return $source.get(attributeName);
                  },
                [attributeName]
              ),
              resolve: EXPORTABLE(
                () =>
                  function resolve(parent: any) {
                    if (!parent) {
                      return null;
                    }
                    // parent is the GeoJSON object from the codec
                    // MultiPolygon GeoJSON format: { type: "MultiPolygon", coordinates: [[[exterior], [interior]], ...] }
                    if (typeof parent === "object" && parent.type === "MultiPolygon" && Array.isArray(parent.coordinates)) {
                      return parent.coordinates;
                    }
                    return null;
                  },
                []
              ),
            }
          );
        }

        if (Object.keys(newFields).length === 0) {
          return fields;
        }

        return build.extend(fields, newFields, "Adding PostGIS MultiPolygon polygons field");
      },
    },
  },
};

