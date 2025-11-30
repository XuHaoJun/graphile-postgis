import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add points array field to LineString geometry columns
 * 
 * This plugin detects PostGIS LineString geometry/geography columns and adds
 * a `points` field that returns an array of coordinate arrays extracted from
 * the LineString geometry.
 */
export const PostgisLineStringFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisLineStringFieldsPlugin",
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

        // Check each attribute to see if it's a PostGIS LineString geometry
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
            // Unconstrained geometry - we can't determine if it's a LineString
            continue;
          }

          // Only add fields for LineString geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.LineString) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add points field - returns array of coordinate arrays
          // For now, we'll extract from GeoJSON. In the future, we could use ST_DumpPoints
          newFields[`${fieldName}_points`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_points`,
            } as any,
            {
              description: build.wrapDescription(
                `An array of coordinate arrays representing the points in this LineString geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(
                    new GraphQLList(
                      new GraphQLNonNull(graphql.GraphQLFloat)
                    )
                  )
                )
              ),
              plan: EXPORTABLE(
                (attributeName) =>
                  function plan($source: any) {
                    // Get the GeoJSON field for this attribute
                    // The GeoJSON is already available as a field, so we can use it
                    // We'll extract coordinates in the resolve function
                    return $source.get(attributeName);
                  },
                [attributeName]
              ),
              // Use a resolve function to extract coordinates from GeoJSON
              // This is called after the plan executes and we have the GeoJSON value
              resolve: EXPORTABLE(
                () =>
                  function resolve(parent: any) {
                    if (!parent) {
                      return null;
                    }
                    // parent is the GeoJSON object from the codec
                    if (typeof parent === "object" && parent.type === "LineString" && Array.isArray(parent.coordinates)) {
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

        return build.extend(fields, newFields, "Adding PostGIS LineString points field");
      },
    },
  },
};

