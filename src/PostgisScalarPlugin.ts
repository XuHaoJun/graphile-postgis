import type { GraphileConfig } from "graphile-config";
import { GraphQLError, Kind, valueFromASTUntyped } from "graphql";
import { EXPORTABLE } from "graphile-build";

const { version } = require("../package.json");

declare global {
  namespace GraphileBuild {
    interface ScopeScalar {
      isGeoJSON?: boolean;
    }
  }
}

/**
 * Plugin to register the GeoJSON scalar type
 * 
 * This scalar accepts GeoJSON objects (not just strings) to support mutations
 * that pass GeoJSON objects directly.
 */
export const PostgisScalarPlugin: GraphileConfig.Plugin = {
  name: "PostgisScalarPlugin",
  version,
  after: ["CommonTypesPlugin"],

  schema: {
    hooks: {
      init(_, build) {
        const geoJSONTypeName = "GeoJSON";

        build.registerScalarType(
          geoJSONTypeName,
          { isGeoJSON: true },
          () => ({
            description: build.wrapDescription(
              "The `GeoJSON` scalar type represents GeoJSON values as specified by [RFC 7946](https://tools.ietf.org/html/rfc7946).",
              "type"
            ),
            // Serialize: return the value as-is (GeoJSON object)
            serialize: EXPORTABLE(() => (value: any) => value, []),
            // ParseValue: accept GeoJSON objects (from variables) or strings (for backwards compatibility)
            parseValue: EXPORTABLE(
              () =>
                (value: any) => {
                  // If it's already an object, return it
                  if (value && typeof value === "object" && !Array.isArray(value)) {
                    return value;
                  }
                  // If it's a string, try to parse it as JSON
                  if (typeof value === "string") {
                    try {
                      return JSON.parse(value);
                    } catch (e) {
                      throw new GraphQLError(
                        `Invalid GeoJSON string: ${e instanceof Error ? e.message : String(e)}`
                      );
                    }
                  }
                  // Otherwise, return as-is (might be null or undefined)
                  return value;
                },
              []
            ),
            // ParseLiteral: accept ObjectValueNode (from GraphQL queries) or StringValueNode
            parseLiteral: EXPORTABLE(
              (Kind, valueFromASTUntyped, GraphQLError, geoJSONTypeName) =>
                (ast: any, variables?: any) => {
                  // Accept ObjectValueNode (object literal in GraphQL)
                  if (ast.kind === Kind.OBJECT) {
                    return valueFromASTUntyped(ast, variables);
                  }
                  // Accept StringValueNode (string literal in GraphQL) for backwards compatibility
                  if (ast.kind === Kind.STRING) {
                    try {
                      return JSON.parse(ast.value);
                    } catch (e) {
                      throw new GraphQLError(
                        `Invalid GeoJSON string: ${e instanceof Error ? e.message : String(e)}`
                      );
                    }
                  }
                  // Reject other types
                  throw new GraphQLError(
                    `${geoJSONTypeName} can only parse object or string values (kind='${ast.kind}')`
                  );
                },
              [Kind, valueFromASTUntyped, GraphQLError, geoJSONTypeName]
            ),
            extensions: {
              grafast: {
                idempotent: true,
              },
            },
          }),
          "PostgisScalarPlugin (GeoJSON type)"
        );

        return _;
      },
    },
  },
};

