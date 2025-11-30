import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import { lambda, type Step } from "grafast";
import { GIS_SUBTYPE } from "./constants";

const { version } = require("../package.json");

/**
 * Plugin to add geometries array field to GeometryCollection geometry columns
 * 
 * This plugin detects PostGIS GeometryCollection geometry/geography columns and adds
 * a `geometries` field that returns an array of GeoJSON geometry objects extracted from
 * the GeometryCollection.
 */
export const PostgisGeometryCollectionFieldsPlugin: GraphileConfig.Plugin = {
  name: "PostgisGeometryCollectionFieldsPlugin",
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

        // Process geometry types (GeometryCollection, etc.)
        if (isPostGISType && isGeometryType && subtype === GIS_SUBTYPE.GeometryCollection) {
          const typeName = (context.Self as any)?.name || 'unknown';
          console.log(`[PostgisGeometryCollectionFieldsPlugin] ✓ Adding geometries field to GeometryCollection geometry type: ${typeName}`);
          const { graphql } = build;
          const { GraphQLList, GraphQLNonNull } = graphql;

          const newFields: Record<string, any> = {};
          const geometryInterfaceType = build.getTypeByName("GeometryInterface") as any;

          // Add geometries field - returns array of geometry objects that implement GeometryInterface
          // Since GeometryCollection can contain different geometry types, we use GeometryInterface
          newFields["geometries"] = fieldWithHooks(
            {
              fieldName: "geometries",
            } as any,
            {
              description: build.wrapDescription(
                `An array of geometry objects in this GeometryCollection. Each geometry implements GeometryInterface.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(geometryInterfaceType)
                )
              ),
              plan: EXPORTABLE(
                () =>
                  function plan($source: any): Step {
                    // $source is the geometry object from the codec: { geojson, srid }
                    // Use lambda to convert null to empty object, ensuring we never return null
                    // This prevents GraphQL from seeing null for a non-nullable field
                    return lambda(
                      $source,
                      (parent: any) => {
                        // Always return an object, never null
                        // If parent is null, return empty object which resolve will convert to []
                        if (parent == null) {
                          return {};
                        }
                        return parent;
                      },
                      true // allow null in input, but we convert it to {} in the function
                    ) as Step;
                  },
                []
              ),
              resolve: EXPORTABLE(
                () =>
                  function resolve(parent: any) {
                    // parent is the full geometry object: { geojson, srid }
                    if (!parent || !parent.geojson) {
                      return [];
                    }
                    
                    // parent is { geojson, srid }
                    const geojson = parent.geojson;
                    const srid = parent.srid || 0;
                    
                    // GeometryCollection GeoJSON format: { type: "GeometryCollection", geometries: [...] }
                    if (typeof geojson === "object" && geojson && geojson.type === "GeometryCollection" && Array.isArray(geojson.geometries)) {
                      // Return geometry objects with geojson and srid fields
                      // Each geometry in the collection is a GeoJSON object, we wrap it with srid
                      return geojson.geometries.map((geom: any) => ({
                        geojson: geom,
                        srid: srid,
                      }));
                    }
                    // Return empty array if no geometries (field is non-nullable list)
                    return [];
                  },
                []
              ),
            }
          );

          if (Object.keys(newFields).length > 0) {
            console.log(`[PostgisGeometryCollectionFieldsPlugin] Added ${Object.keys(newFields).length} fields to ${typeName}`);
            return build.extend(
              fields,
              newFields,
              "Adding PostGIS GeometryCollection geometries field to geometry type"
            );
          }
        }

        // Only process table types with attributes
        if (!isPgClassType || !pgCodec?.attributes) {
          return fields;
        }

        const { inflection, graphql } = build;
        const { GraphQLList, GraphQLNonNull } = graphql;

        // Check each attribute to see if it's a PostGIS GeometryCollection geometry
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
            // Unconstrained geometry - we can't determine if it's a GeometryCollection
            continue;
          }

          // Only add fields for GeometryCollection geometry types
          if (typeDetails.subtype !== GIS_SUBTYPE.GeometryCollection) {
            continue;
          }

          const fieldName = (inflection as any).attribute({ attributeName, codec: pgCodec });

          // Add geometries field - returns array of GeoJSON geometry objects
          // GeometryCollection GeoJSON format: { type: "GeometryCollection", geometries: [{ type: "Point", coordinates: [...] }, ...] }
          newFields[`${fieldName}_geometries`] = fieldWithHooks(
            {
              fieldName: `${fieldName}_geometries`,
            } as any,
            {
              description: build.wrapDescription(
                `An array of GeoJSON geometry objects in this GeometryCollection.`,
                "field"
              ),
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(graphql.GraphQLString) // Return as JSON strings since we can't use GeoJSON scalar in a list
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
                    // GeometryCollection GeoJSON format: { type: "GeometryCollection", geometries: [...] }
                    if (typeof parent === "object" && parent.type === "GeometryCollection" && Array.isArray(parent.geometries)) {
                      // Return the geometries array as JSON strings
                      // Note: We use JSON strings because GraphQL doesn't support scalar types in lists directly
                      // In the future, we could create a custom GraphQL type for geometry arrays
                      return parent.geometries.map((geom: any) => JSON.stringify(geom));
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

        return build.extend(fields, newFields, "Adding PostGIS GeometryCollection geometries field");
      },
    },
  },
};

