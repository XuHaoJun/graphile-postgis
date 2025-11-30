import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { Step } from "grafast";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add exterior and interiors fields to Polygon geometry columns
 * 
 * This plugin detects PostGIS Polygon geometry/geography columns and adds
 * `exterior` and `interiors` fields that extract the exterior ring and
 * interior rings (holes) from the Polygon geometry.
 */
export const PostgisPolygonFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisPolygonFieldsPlugin",
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

        // Process geometry types (GeometryPolygon, etc.)
        if (isPostGISType && isGeometryType && subtype === GIS_SUBTYPE.Polygon) {
          const typeName = (context.Self as any)?.name || 'unknown';
          console.log(`[PostgisPolygonFieldsPlugin] ✓ Adding exterior and interiors fields to Polygon geometry type: ${typeName}`);
          const { graphql } = build;
          const { GraphQLList, GraphQLNonNull } = graphql;

          const newFields: Record<string, any> = {};
          const geometryLineStringType = build.getTypeByName("GeometryLineString") as any;

          // Add exterior field - returns the exterior ring as a GeometryLineString
          newFields["exterior"] = fieldWithHooks(
            {
              fieldName: "exterior",
            } as any,
            {
              description: build.wrapDescription(
                `The exterior ring of this Polygon geometry as a LineString.`,
                "field"
              ),
              type: new GraphQLNonNull(geometryLineStringType),
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
                    
                    // Polygon GeoJSON format: { type: "Polygon", coordinates: [[exterior], [interior1], [interior2], ...] }
                    if (typeof geojson === "object" && geojson.type === "Polygon" && Array.isArray(geojson.coordinates) && geojson.coordinates.length > 0) {
                      // First ring is the exterior ring - create a LineString GeoJSON
                      return {
                        geojson: {
                          type: "LineString",
                          coordinates: geojson.coordinates[0],
                        },
                        srid: srid,
                      };
                    }
                    return null;
                  },
                []
              ),
            }
          );

          // Add interiors field - returns array of interior rings (holes) as GeometryLineString objects
          newFields["interiors"] = fieldWithHooks(
            {
              fieldName: "interiors",
            } as any,
            {
              description: build.wrapDescription(
                `The interior rings (holes) of this Polygon geometry as an array of LineStrings.`,
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
                    
                    // Polygon GeoJSON format: { type: "Polygon", coordinates: [[exterior], [interior1], [interior2], ...] }
                    if (typeof geojson === "object" && geojson.type === "Polygon" && Array.isArray(geojson.coordinates) && geojson.coordinates.length > 1) {
                      // All rings after the first are interior rings - create LineString GeoJSON objects
                      return geojson.coordinates.slice(1).map((ring: number[][]) => ({
                        geojson: {
                          type: "LineString",
                          coordinates: ring,
                        },
                        srid: srid,
                      }));
                    }
                    // If there are no interior rings, return empty array
                    return [];
                  },
                []
              ),
            }
          );

          if (Object.keys(newFields).length > 0) {
            console.log(`[PostgisPolygonFieldsPlugin] Added ${Object.keys(newFields).length} fields to ${typeName}`);
            return build.extend(
              fields,
              newFields,
              "Adding PostGIS Polygon exterior and interiors fields to geometry type"
            );
          }
        }

        // Only process table types with attributes
        if (!isPgClassType || !pgCodec?.attributes) {
          return fields;
        }

        const { inflection, graphql } = build;
        const { GraphQLList, GraphQLNonNull } = graphql;

        // Check each attribute to see if it's a PostGIS Polygon geometry
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
            // Unconstrained geometry - we can't determine if it's a Polygon
            continue;
          }

          // Only add fields for Polygon geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.Polygon) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add exterior field - returns the exterior ring as an array of coordinates
          newFields[`${fieldName}_exterior`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_exterior`,
            } as any,
            {
              description: build.wrapDescription(
                `The exterior ring of this Polygon geometry as an array of coordinate arrays.`,
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
                  function plan($source: any): Step {
                    // Get the GeoJSON field for this attribute
                    return $source.get(attributeName) as Step;
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
                    // Polygon GeoJSON format: { type: "Polygon", coordinates: [[exterior], [interior1], [interior2], ...] }
                    if (typeof parent === "object" && parent.type === "Polygon" && Array.isArray(parent.coordinates) && parent.coordinates.length > 0) {
                      // First ring is the exterior ring
                      return parent.coordinates[0];
                    }
                    return null;
                  },
                []
              ),
            }
          );

          // Add interiors field - returns array of interior rings (holes)
          newFields[`${fieldName}_interiors`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_interiors`,
            } as any,
            {
              description: build.wrapDescription(
                `The interior rings (holes) of this Polygon geometry as an array of coordinate arrays.`,
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
                  function plan($source: any): Step {
                    // Get the GeoJSON field for this attribute
                    return $source.get(attributeName) as Step;
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
                    // Polygon GeoJSON format: { type: "Polygon", coordinates: [[exterior], [interior1], [interior2], ...] }
                    if (typeof parent === "object" && parent.type === "Polygon" && Array.isArray(parent.coordinates) && parent.coordinates.length > 1) {
                      // All rings after the first are interior rings
                      return parent.coordinates.slice(1);
                    }
                    // If there are no interior rings, return empty array
                    return [];
                  },
                []
              ),
            }
          );
        }

        if (Object.keys(newFields).length === 0) {
          return fields;
        }

        return build.extend(fields, newFields, "Adding PostGIS Polygon exterior and interiors fields");
      },
    },
  },
};

