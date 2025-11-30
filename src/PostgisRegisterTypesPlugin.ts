import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import { get, type Step } from "grafast";
import { GIS_SUBTYPE, GIS_SUBTYPE_NAME } from "./constants";
import type { Subtype } from "./types";

declare global {
  namespace GraphileBuild {
    interface ScopeInterface {
      isPostGISInterface?: boolean;
      isGeometryInterface?: boolean;
      isGeometryDimensionInterface?: boolean;
      hasZ?: boolean;
      hasM?: boolean;
    }
    interface ScopeObject {
      isPostGISType?: boolean;
      isGeometryType?: boolean;
      subtype?: Subtype;
      hasZ?: boolean;
      hasM?: boolean;
    }
  }
}

const { version } = require("../package.json");

// Module-level storage for the getGeometryType implementation
// This allows the build hook to create a function that will be populated in init
let getGeometryTypeImpl: ((codecName: string, subtype: Subtype, hasZ: boolean, hasM: boolean) => string) | null = null;

/**
 * Plugin to register GraphQL object types and interfaces for PostGIS geometry types.
 * 
 * This plugin creates:
 * - GeometryInterface: Base interface for all geometry types
 * - Dimension-specific interfaces (GeometryXYInterface, GeometryXYZInterface, etc.)
 * - Concrete types: GeometryPoint, GeometryLineString, GeometryPolygon, etc.
 */
export const PostgisRegisterTypesPlugin: GraphileConfig.Plugin = {
  name: "PostgisRegisterTypesPlugin",
  version,
  after: ["PostgisScalarPlugin"],
  before: ["PostgisTypesPlugin"],

  schema: {
    hooks: {
      build(build) {
        // Add helper function to build object using extend
        // The implementation will be set in the init hook
        return build.extend(
          build,
          {
            getPostGISGeometryType: (
              codecName: string,
              subtype: Subtype,
              hasZ: boolean,
              hasM: boolean
            ) => {
              if (!getGeometryTypeImpl) {
                throw new Error(
                  "getPostGISGeometryType called before PostgisRegisterTypesPlugin init hook"
                );
              }
              return getGeometryTypeImpl(codecName, subtype, hasZ, hasM);
            },
          },
          "PostgisRegisterTypesPlugin (getPostGISGeometryType)"
        );
      },
      init(_, build) {
        const { inflection, graphql } = build;
        const { GraphQLInt, GraphQLNonNull } = graphql;

        // Don't call getTypeByName here - use thunks instead
        // We'll reference "GeoJSON" as a string and let Graphile resolve it later

        const geojsonFieldName = inflection.geojsonFieldName();

        // Cache for interface and type names (not the actual types)
        const interfaceNames: Record<string, string> = {};
        const typeNames: Record<string, string> = {};

        /**
         * Get or create the base GeometryInterface
         */
        function getGeometryInterface() {
          const interfaceName = "GeometryInterface";
          if (interfaceNames[interfaceName]) {
            return interfaceNames[interfaceName];
          }

          build.registerInterfaceType(
            interfaceName,
            { isPostGISInterface: true, isGeometryInterface: true },
            () => ({
              description: build.wrapDescription(
                "Base interface for all PostGIS geometry types. All geometry types implement this interface.",
                "type"
              ),
              fields: () => ({
                [geojsonFieldName]: {
                  type: new GraphQLNonNull(build.getTypeByName("GeoJSON") as any),
                  description: build.wrapDescription(
                    "Converts the object to GeoJSON format as specified by RFC 7946.",
                    "field"
                  ),
                },
                srid: {
                  type: new GraphQLNonNull(GraphQLInt),
                  description: build.wrapDescription(
                    "Spatial Reference System Identifier (SRID).",
                    "field"
                  ),
                },
              }),
            }),
            "PostgisRegisterTypesPlugin (GeometryInterface)"
          );

          interfaceNames[interfaceName] = interfaceName;
          return interfaceName;
        }

        /**
         * Get or create dimension-specific interface
         */
        function getDimensionInterface(hasZ: boolean, hasM: boolean) {
          const zmflag = (hasZ ? 2 : 0) + (hasM ? 1 : 0);
          const coords = { 0: "XY", 1: "XYM", 2: "XYZ", 3: "XYZM" }[zmflag];
          const interfaceName = `Geometry${coords}Interface`;

          if (interfaceNames[interfaceName]) {
            return interfaceName;
          }

          build.registerInterfaceType(
            interfaceName,
            {
              isPostGISInterface: true,
              isGeometryDimensionInterface: true,
              hasZ,
              hasM,
            },
            () => ({
              description: build.wrapDescription(
                `All geometry ${coords} types implement this interface.`,
                "type"
              ),
              interfaces: () => {
                const baseInterfaceName = getGeometryInterface();
                return [build.getTypeByName(baseInterfaceName) as any];
              },
              fields: () => ({
                [geojsonFieldName]: {
                  type: new GraphQLNonNull(build.getTypeByName("GeoJSON") as any),
                  description: build.wrapDescription(
                    "Converts the object to GeoJSON format as specified by RFC 7946.",
                    "field"
                  ),
                },
                srid: {
                  type: new GraphQLNonNull(GraphQLInt),
                  description: build.wrapDescription(
                    "Spatial Reference System Identifier (SRID).",
                    "field"
                  ),
                },
              }),
            }),
            `PostgisRegisterTypesPlugin (${interfaceName})`
          );

          interfaceNames[interfaceName] = interfaceName;
          return interfaceName;
        }

        /**
         * Get or create a concrete geometry type
         */
        function getGeometryType(
          codecName: string,
          subtype: Subtype,
          hasZ: boolean,
          hasM: boolean
        ) {
          const typeName = inflection.gisType(
            { name: codecName } as any,
            subtype,
            hasZ,
            hasM
          );

          // Use a key that includes codec name, subtype and dimensions
          const typeKey = `${codecName}-${subtype}-${hasZ}-${hasM}`;
          if (typeNames[typeKey]) {
            return typeNames[typeKey];
          }

          const baseInterfaceName = getGeometryInterface();
          const dimensionInterfaceName = getDimensionInterface(hasZ, hasM);
          const subtypeName = GIS_SUBTYPE_NAME[subtype];

          // Build interfaces array - use thunk to resolve interface types
          const typeInterfaces = () => [
            build.getTypeByName(baseInterfaceName) as any,
            build.getTypeByName(dimensionInterfaceName) as any,
          ];

          // Build fields based on subtype
          // Note: The geojson and srid fields will be populated from the codec's result
          // The codec should return an object with { geojson, srid } structure
          const fields = () => ({
            [geojsonFieldName]: {
              type: new GraphQLNonNull(build.getTypeByName("GeoJSON") as any),
              description: build.wrapDescription(
                "Converts the object to GeoJSON format as specified by RFC 7946.",
                "field"
              ),
              plan: EXPORTABLE(
                () =>
                  function plan($source: any): Step {
                    // $source is the result from the codec: { geojson, srid }
                    // Use get() step to access the 'geojson' property
                    return get($source, 'geojson') as Step;
                  },
                []
              ),
            },
            srid: {
              type: new GraphQLNonNull(GraphQLInt),
              description: build.wrapDescription(
                "Spatial Reference System Identifier (SRID).",
                "field"
              ),
              plan: EXPORTABLE(
                () =>
                  function plan($source: any): Step {
                    // $source is the result from the codec: { geojson, srid }
                    // Use get() step to access the 'srid' property
                    return get($source, 'srid') as Step;
                  },
                []
              ),
            },
          });

          // Add type-specific fields
          if (subtype === GIS_SUBTYPE.Point) {
            // Point types have x, y, and optionally z fields
            // These will be added by PostgisPointFieldsPlugin
            // We just register the type here
          } else if (subtype === GIS_SUBTYPE.LineString) {
            // LineString types have points array
            // This will be added by PostgisLineStringFieldsPlugin
          } else if (subtype === GIS_SUBTYPE.Polygon) {
            // Polygon types have exterior and interiors
            // This will be added by PostgisPolygonFieldsPlugin
          } else if (subtype === GIS_SUBTYPE.MultiPoint) {
            // MultiPoint types have points array
            // This will be added by PostgisMultiPointFieldsPlugin
          } else if (subtype === GIS_SUBTYPE.MultiLineString) {
            // MultiLineString types have lineStrings array
            // This will be added by PostgisMultiLineStringFieldsPlugin
          } else if (subtype === GIS_SUBTYPE.MultiPolygon) {
            // MultiPolygon types have polygons array
            // This will be added by PostgisMultiPolygonFieldsPlugin
          } else if (subtype === GIS_SUBTYPE.GeometryCollection) {
            // GeometryCollection types have geometries array
            // This will be added by PostgisGeometryCollectionFieldsPlugin
          }

          build.registerObjectType(
            typeName,
            {
              isPostGISType: true,
              isGeometryType: true,
              subtype,
              hasZ,
              hasM,
            },
            () => ({
              description: build.wrapDescription(
                `Represents a ${subtypeName}${hasZ ? " with Z coordinates" : ""}${hasM ? " with M coordinates" : ""} geometry.`,
                "type"
              ),
              interfaces: typeInterfaces,
              fields: fields,
            }),
            `PostgisRegisterTypesPlugin (${typeName})`
          );

          typeNames[typeKey] = typeName;
          return typeName;
        }

        // Pre-register all geometry and geography types that might be needed
        // This ensures they exist when codecs try to reference them
        const subtypes: Subtype[] = [
          GIS_SUBTYPE.Point,
          GIS_SUBTYPE.LineString,
          GIS_SUBTYPE.Polygon,
          GIS_SUBTYPE.MultiPoint,
          GIS_SUBTYPE.MultiLineString,
          GIS_SUBTYPE.MultiPolygon,
          GIS_SUBTYPE.GeometryCollection,
        ];

        // Register types for both geometry and geography codecs
        for (const codecName of ["geometry", "geography"]) {
          for (const subtype of subtypes) {
            for (const hasZ of [false, true]) {
              for (const hasM of [false, true]) {
                getGeometryType(codecName, subtype, hasZ, hasM);
              }
            }
          }
        }

        // Register a generic "Geometry" type for unconstrained geometries
        // This type implements GeometryInterface and can be used for geometry columns
        // that don't have a specific subtype constraint
        // Note: We register this for both "geometry" and "geography" base types
        for (const codecName of ["geometry", "geography"]) {
          const geometryTypeName = inflection.gisType(
            { name: codecName } as any,
            0, // subtype 0 = generic geometry
            false, // no Z
            false  // no M
          );
          
          // Check if this type was already registered by getGeometryType above
          // If not, register it now for unconstrained geometries
          const typeKey = `${codecName}-0-false-false`;
          if (!typeNames[typeKey]) {
            const baseInterfaceName = getGeometryInterface();
            build.registerObjectType(
              geometryTypeName,
              {
                isPostGISType: true,
                isGeometryType: true,
                subtype: 0, // GIS_SUBTYPE.Geometry
                hasZ: false,
                hasM: false,
              },
              () => ({
                description: build.wrapDescription(
                  `Represents an unconstrained ${codecName} that can be any geometry type.`,
                  "type"
                ),
                interfaces: () => [
                  build.getTypeByName(baseInterfaceName) as any,
                ],
                fields: () => ({
                  [geojsonFieldName]: {
                    type: new GraphQLNonNull(build.getTypeByName("GeoJSON") as any),
                    description: build.wrapDescription(
                      "Converts the object to GeoJSON format as specified by RFC 7946.",
                      "field"
                    ),
                    plan: EXPORTABLE(
                      () =>
                        function plan($source: any): Step {
                          return get($source, 'geojson') as Step;
                        },
                      []
                    ),
                  },
                  srid: {
                    type: new GraphQLNonNull(GraphQLInt),
                    description: build.wrapDescription(
                      "Spatial Reference System Identifier (SRID).",
                      "field"
                    ),
                    plan: EXPORTABLE(
                      () =>
                        function plan($source: any): Step {
                          return get($source, 'srid') as Step;
                        },
                      []
                    ),
                  },
                }),
              }),
              `PostgisRegisterTypesPlugin (${geometryTypeName} for unconstrained geometries)`
            );
            typeNames[typeKey] = geometryTypeName;
          }
        }

        // Store the implementation function in the module-level variable
        // This will be used by the helper function added in the build hook
        getGeometryTypeImpl = getGeometryType;

        return _;
      },
    },
  },
};

