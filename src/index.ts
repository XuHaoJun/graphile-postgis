import type { GraphileConfig } from "graphile-config";
import { PostgisInflectionPlugin } from "./inflection";
import { PostgisExtensionPlugin } from "./PostgisExtensionPlugin";
import { PostgisCodecPlugin } from "./PostgisCodecPlugin";
import { PostgisScalarPlugin } from "./PostgisScalarPlugin";
import { PostgisTypesPlugin } from "./PostgisTypesPlugin";
import { PostgisMutationPlugin } from "./PostgisMutationPlugin";
import { PostgisPointFieldsPlugin } from "./PostgisPointFieldsPlugin";
import { PostgisLineStringFieldsPlugin } from "./PostgisLineStringFieldsPlugin";
import { PostgisPolygonFieldsPlugin } from "./PostgisPolygonFieldsPlugin";

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
    PostgisTypesPlugin,
    PostgisMutationPlugin,
    PostgisPointFieldsPlugin,
    PostgisLineStringFieldsPlugin,
    PostgisPolygonFieldsPlugin,
  ],
};

export default postgisPlugin;

// Export individual plugins for advanced usage
export { PostgisInflectionPlugin } from "./inflection";
export { PostgisExtensionPlugin } from "./PostgisExtensionPlugin";
export { PostgisCodecPlugin } from "./PostgisCodecPlugin";
export { PostgisScalarPlugin } from "./PostgisScalarPlugin";
export { PostgisTypesPlugin } from "./PostgisTypesPlugin";
export { PostgisMutationPlugin } from "./PostgisMutationPlugin";
export { PostgisPointFieldsPlugin } from "./PostgisPointFieldsPlugin";
export { PostgisLineStringFieldsPlugin } from "./PostgisLineStringFieldsPlugin";
export { PostgisPolygonFieldsPlugin } from "./PostgisPolygonFieldsPlugin";

// Export utilities
export { getGISTypeDetails, getGISTypeModifier, getGISTypeName } from "./utils";
export type { Subtype, GISTypeDetails } from "./types";
export { validateGeoJSON, validateGeoJSONStructure, validateCoordinates } from "./validation";
export type { GeoJSONValidationError } from "./validation";

