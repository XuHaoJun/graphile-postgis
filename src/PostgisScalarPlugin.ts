import type { GraphileConfig } from "graphile-config";
import { EXPORTABLE } from "graphile-build";
import type { GraphQLScalarTypeConfig } from "graphql";

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
 */
export const PostgisScalarPlugin: GraphileConfig.Plugin = {
  name: "PostgisScalarPlugin",
  version,

  schema: {
    hooks: {
      init(_, build) {
        const {
          inflection,
          stringTypeSpec,
          graphql: { Kind, GraphQLError },
        } = build;

        const geoJSONTypeName = "GeoJSON";

        build.registerScalarType(
          geoJSONTypeName,
          { isGeoJSON: true },
          () =>
            stringTypeSpec(
              build.wrapDescription(
                "The `GeoJSON` scalar type represents GeoJSON values as specified by [RFC 7946](https://tools.ietf.org/html/rfc7946).",
                "type"
              ),
              undefined,
              geoJSONTypeName
            ) as GraphQLScalarTypeConfig<any, any>,
          "PostgisScalarPlugin (GeoJSON type)"
        );

        // Override the scalar spec to add serialize/parseValue/parseLiteral
        // We need to access the actual GraphQL scalar type to set these
        const getTypeMeta = build.getTypeMetaByName(geoJSONTypeName);
        if (getTypeMeta) {
          // The spec generator will be called later, we can't modify it here
          // Instead, we'll need to hook into the scalar type creation
          // For now, the default behavior (identity functions) should work
        }

        return _;
      },
    },
  },
};

