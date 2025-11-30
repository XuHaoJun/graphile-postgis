import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { Step } from "grafast";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add points array field to MultiPoint geometry columns
 * 
 * This plugin detects PostGIS MultiPoint geometry/geography columns and adds
 * a `points` field that returns an array of coordinate arrays extracted from
 * the MultiPoint geometry.
 */
export const PostgisMultiPointFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisMultiPointFieldsPlugin",
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
        const isPostGISType = objectScope.isPostGISType;
        const isGeometryType = objectScope.isGeometryType;
        const subtype = objectScope.subtype;

        // Process geometry types (GeometryMultiPoint, etc.)
        if (isPostGISType && isGeometryType && subtype === GIS_SUBTYPE.MultiPoint) {
          const typeName = (context.Self as any)?.name || 'unknown';
          console.log(`[PostgisMultiPointFieldsPlugin] ✓ Adding points field to MultiPoint geometry type: ${typeName}`);
          const { graphql } = build;
          const { GraphQLList, GraphQLNonNull } = graphql;

          const newFields: Record<string, any> = {};
          const geometryPointType = build.getTypeByName("GeometryPoint") as any;

          // Add points field - returns array of GeometryPoint objects
          newFields["points"] = fieldWithHooks(
            {
              fieldName: "points",
            } as any,
            {
              description: build.wrapDescription(
                `An array of Point geometries representing the points in this MultiPoint geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(geometryPointType)
                )
              ),
              plan: EXPORTABLE(
                () =>
                  function plan($source: any): Step {
                    // $source is the geometry object from the codec: { geojson, srid }
                    // Return the full geometry object so we can access both geojson and srid in resolve
                    return $source as Step;
                  },
                []
              ),
              resolve: EXPORTABLE(
                () =>
                  function resolve(parent: any) {
                    if (!parent || !parent.geojson) {
                      return null;
                    }
                    // parent is the full geometry object: { geojson, srid }
                    const geojson = parent.geojson;
                    const srid = parent.srid || 0;
                    
                    // MultiPoint GeoJSON format: { type: "MultiPoint", coordinates: [[x1, y1], [x2, y2], ...] }
                    if (typeof geojson === "object" && geojson.type === "MultiPoint" && Array.isArray(geojson.coordinates)) {
                      // Create GeometryPoint objects for each coordinate
                      return geojson.coordinates.map((coord: number[]) => {
                        const [x, y, z] = coord;
                        return {
                          geojson: {
                            type: "Point",
                            coordinates: coord,
                          },
                          srid: srid,
                          x: x,
                          y: y,
                          ...(z !== undefined ? { z: z } : {}),
                        };
                      });
                    }
                    return null;
                  },
                []
              ),
            }
          );

          if (Object.keys(newFields).length > 0) {
            console.log(`[PostgisMultiPointFieldsPlugin] Added ${Object.keys(newFields).length} fields to ${typeName}`);
            return build.extend(
              fields,
              newFields,
              "Adding PostGIS MultiPoint points field to geometry type"
            );
          }
        }

        // Only process table types with attributes
        if (!isPgClassType || !pgCodec?.attributes) {
          return fields;
        }

        const { inflection, graphql } = build;
        const { GraphQLList, GraphQLNonNull } = graphql;

        // Check each attribute to see if it's a PostGIS MultiPoint geometry
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
            // Unconstrained geometry - we can't determine if it's a MultiPoint
            continue;
          }

          // Only add fields for MultiPoint geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.MultiPoint) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add points field - returns array of coordinate arrays
          // MultiPoint GeoJSON format: { type: "MultiPoint", coordinates: [[x1, y1], [x2, y2], ...] }
          newFields[`${fieldName}_points`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_points`,
            } as any,
            {
              description: build.wrapDescription(
                `An array of coordinate arrays representing the points in this MultiPoint geometry.`,
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
                    // MultiPoint GeoJSON format: { type: "MultiPoint", coordinates: [[x1, y1], [x2, y2], ...] }
                    if (typeof parent === "object" && parent.type === "MultiPoint" && Array.isArray(parent.coordinates)) {
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

        return build.extend(fields, newFields, "Adding PostGIS MultiPoint points field");
      },
    },
  },
};

