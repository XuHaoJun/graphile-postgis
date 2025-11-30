import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { Step } from "grafast";
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
        const isPostGISType = objectScope.isPostGISType;
        const isGeometryType = objectScope.isGeometryType;
        const subtype = objectScope.subtype;

        // Process geometry types (GeometryLineString, etc.)
        if (isPostGISType && isGeometryType && subtype === GIS_SUBTYPE.LineString) {
          const typeName = (context.Self as any)?.name || 'unknown';
          console.log(`[PostgisLineStringFieldsPlugin] ✓ Adding points field to LineString geometry type: ${typeName}`);
          const { graphql } = build;
          const { GraphQLList, GraphQLNonNull } = graphql;

          const newFields: Record<string, any> = {};

          // Add points field - returns array of GeometryPoint objects
          const geometryPointType = build.getTypeByName("GeometryPoint") as any;
          newFields["points"] = fieldWithHooks(
            {
              fieldName: "points",
            } as any,
            {
              description: build.wrapDescription(
                `An array of Point geometries representing the points in this LineString geometry.`,
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
              // Use a resolve function to create GeometryPoint objects from coordinates
              resolve: EXPORTABLE(
                () =>
                  function resolve(parent: any) {
                    if (!parent || !parent.geojson) {
                      return null;
                    }
                    // parent is the full geometry object: { geojson, srid }
                    const geojson = parent.geojson;
                    const srid = parent.srid || 0;
                    
                    if (typeof geojson === "object" && geojson.type === "LineString" && Array.isArray(geojson.coordinates)) {
                      // Create GeometryPoint objects for each coordinate
                      // Each point needs: { geojson: Point GeoJSON, srid: number, x: number, y: number, z?: number }
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
            console.log(`[PostgisLineStringFieldsPlugin] Added ${Object.keys(newFields).length} fields to ${typeName}`);
            return build.extend(
              fields,
              newFields,
              "Adding PostGIS LineString points field to geometry type"
            );
          }
        }

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

