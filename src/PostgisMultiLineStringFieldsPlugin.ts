import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { Step } from "grafast";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add lineStrings array field to MultiLineString geometry columns
 * 
 * This plugin detects PostGIS MultiLineString geometry/geography columns and adds
 * a `lineStrings` field that returns an array of coordinate arrays (one per LineString)
 * extracted from the MultiLineString geometry.
 */
export const PostgisMultiLineStringFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisMultiLineStringFieldsPlugin",
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

        // Process geometry types (GeometryMultiLineString, etc.)
        if (isPostGISType && isGeometryType && subtype === GIS_SUBTYPE.MultiLineString) {
          const typeName = (context.Self as any)?.name || 'unknown';
          console.log(`[PostgisMultiLineStringFieldsPlugin] ✓ Adding lineStrings field to MultiLineString geometry type: ${typeName}`);
          const { graphql } = build;
          const { GraphQLList, GraphQLNonNull } = graphql;

          const newFields: Record<string, any> = {};
          const geometryLineStringType = build.getTypeByName("GeometryLineString") as any;

          // Add lineStrings field - returns array of GeometryLineString objects
          newFields["lineStrings"] = fieldWithHooks(
            {
              fieldName: "lineStrings",
            } as any,
            {
              description: build.wrapDescription(
                `An array of LineString geometries in this MultiLineString geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(geometryLineStringType)
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
                    
                    // MultiLineString GeoJSON format: { type: "MultiLineString", coordinates: [[[x1, y1], [x2, y2]], ...] }
                    if (typeof geojson === "object" && geojson.type === "MultiLineString" && Array.isArray(geojson.coordinates)) {
                      // Create GeometryLineString objects for each LineString
                      return geojson.coordinates.map((lineStringCoords: number[][]) => ({
                        geojson: {
                          type: "LineString",
                          coordinates: lineStringCoords,
                        },
                        srid: srid,
                      }));
                    }
                    return null;
                  },
                []
              ),
            }
          );

          if (Object.keys(newFields).length > 0) {
            console.log(`[PostgisMultiLineStringFieldsPlugin] Added ${Object.keys(newFields).length} fields to ${typeName}`);
            return build.extend(
              fields,
              newFields,
              "Adding PostGIS MultiLineString lineStrings field to geometry type"
            );
          }
        }

        // Only process table types with attributes
        if (!isPgClassType || !pgCodec?.attributes) {
          return fields;
        }

        const { inflection, graphql } = build;
        const { GraphQLList, GraphQLNonNull } = graphql;

        // Check each attribute to see if it's a PostGIS MultiLineString geometry
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
            // Unconstrained geometry - we can't determine if it's a MultiLineString
            continue;
          }

          // Only add fields for MultiLineString geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.MultiLineString) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add lineStrings field - returns array of LineString coordinate arrays
          // MultiLineString GeoJSON format: { type: "MultiLineString", coordinates: [[[x1, y1], [x2, y2]], [[x3, y3], [x4, y4]], ...] }
          newFields[`${fieldName}_lineStrings`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_lineStrings`,
            } as any,
            {
              description: build.wrapDescription(
                `An array of LineString coordinate arrays in this MultiLineString geometry.`,
                "field"
              ),
              type: new GraphQLNonNull(
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
                    // MultiLineString GeoJSON format: { type: "MultiLineString", coordinates: [[[x1, y1], [x2, y2]], ...] }
                    if (typeof parent === "object" && parent.type === "MultiLineString" && Array.isArray(parent.coordinates)) {
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

        return build.extend(fields, newFields, "Adding PostGIS MultiLineString lineStrings field");
      },
    },
  },
};

