import type { GraphileConfig } from "graphile-config";
import { PostgisInflectionPlugin } from "./inflection";
import { PostgisExtensionPlugin } from "./PostgisExtensionPlugin";
import { PostgisCodecPlugin } from "./PostgisCodecPlugin";
import { PostgisScalarPlugin } from "./PostgisScalarPlugin";
import { PostgisRegisterTypesPlugin } from "./PostgisRegisterTypesPlugin";
import { PostgisTypesPlugin } from "./PostgisTypesPlugin";
import { PostgisMutationPlugin } from "./PostgisMutationPlugin";
import { PostgisPointFieldsPlugin } from "./PostgisPointFieldsPlugin";
import { PostgisLineStringFieldsPlugin } from "./PostgisLineStringFieldsPlugin";
import { PostgisPolygonFieldsPlugin } from "./PostgisPolygonFieldsPlugin";
import { PostgisMultiPointFieldsPlugin } from "./PostgisMultiPointFieldsPlugin";
import { PostgisMultiLineStringFieldsPlugin } from "./PostgisMultiLineStringFieldsPlugin";
import { PostgisMultiPolygonFieldsPlugin } from "./PostgisMultiPolygonFieldsPlugin";
import { PostgisGeometryCollectionFieldsPlugin } from "./PostgisGeometryCollectionFieldsPlugin";

/**
 * Main PostGIS plugin preset for PostGraphile v5
 *
 * This plugin provides comprehensive PostGIS support, including:
 * - PostGIS extension detection
 * - Custom codecs for geometry/geography types
 * - GeoJSON scalar type
 * - GraphQL type mapping
 *
 * @example
 * ```ts
 * import { postgraphile } from "postgraphile";
 * import { postgisPlugin } from "@graphile/postgis-v5";
 *
 * const app = postgraphile({
 *   database: "my_database",
 *   schemas: ["public"],
 *   plugins: [postgisPlugin],
 * });
 * ```
 */
export const postgisPlugin: GraphileConfig.Preset = {
  plugins: [
    PostgisInflectionPlugin,
    PostgisExtensionPlugin,
    PostgisCodecPlugin,
    PostgisScalarPlugin,
    PostgisRegisterTypesPlugin,
    PostgisTypesPlugin,
    PostgisMutationPlugin,
    PostgisPointFieldsPlugin,
    PostgisLineStringFieldsPlugin,
    PostgisPolygonFieldsPlugin,
    PostgisMultiPointFieldsPlugin,
    PostgisMultiLineStringFieldsPlugin,
    PostgisMultiPolygonFieldsPlugin,
    PostgisGeometryCollectionFieldsPlugin,
  ],
};

export default postgisPlugin;

// Export individual plugins for advanced usage
export { PostgisInflectionPlugin } from "./inflection";
export { PostgisExtensionPlugin } from "./PostgisExtensionPlugin";
export { PostgisCodecPlugin } from "./PostgisCodecPlugin";
export { PostgisScalarPlugin } from "./PostgisScalarPlugin";
export { PostgisRegisterTypesPlugin } from "./PostgisRegisterTypesPlugin";
export { PostgisTypesPlugin } from "./PostgisTypesPlugin";
export { PostgisMutationPlugin } from "./PostgisMutationPlugin";
export { PostgisPointFieldsPlugin } from "./PostgisPointFieldsPlugin";
export { PostgisLineStringFieldsPlugin } from "./PostgisLineStringFieldsPlugin";
export { PostgisPolygonFieldsPlugin } from "./PostgisPolygonFieldsPlugin";
export { PostgisMultiPointFieldsPlugin } from "./PostgisMultiPointFieldsPlugin";
export { PostgisMultiLineStringFieldsPlugin } from "./PostgisMultiLineStringFieldsPlugin";
export { PostgisMultiPolygonFieldsPlugin } from "./PostgisMultiPolygonFieldsPlugin";
export { PostgisGeometryCollectionFieldsPlugin } from "./PostgisGeometryCollectionFieldsPlugin";

// Export utilities
export { getGISTypeDetails, getGISTypeModifier, getGISTypeName } from "./utils";
export type { Subtype, GISTypeDetails } from "./types";
export { validateGeoJSON, validateGeoJSONStructure, validateCoordinates } from "./validation";
export type { GeoJSONValidationError } from "./validation";

