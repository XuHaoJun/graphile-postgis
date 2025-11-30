import type { GraphileConfig } from "graphile-config";
import type { GatherPluginContext } from "graphile-build";
import type { PgCodec } from "@dataplan/pg";

const { version } = require("../package.json");

interface State {}
interface Cache {}

/**
 * Plugin to register GraphQL types for PostGIS geometry/geography codecs
 * Maps PostGIS codecs to the GeoJSON scalar type
 */
export const PostgisTypesPlugin: GraphileConfig.Plugin = {
  name: "PostgisTypesPlugin",
  version,
  after: ["PostgisCodecPlugin", "PostgisScalarPlugin"],

  gather: {
    hooks: {
      // After codecs are created, map them to GraphQL types
      async pgCodecs_PgCodec(
        _info: GatherPluginContext<State, Cache>,
        event: {
          serviceName: string;
          pgCodec: PgCodec;
          pgType: any;
        }
      ) {
        const { pgCodec } = event;

        // Mark geometry and geography codecs for later mapping
        if (pgCodec.name === "geometry" || pgCodec.name === "geography") {
          // Store a flag that this codec should use GeoJSON
          if (!pgCodec.extensions) {
            pgCodec.extensions = Object.create(null);
          }
          if (!(pgCodec.extensions as any).tags) {
            (pgCodec.extensions as any).tags = Object.create(null);
          }
          (pgCodec.extensions as any).tags.isPostGIS = true;
        }
      },
    },
  },

  schema: {
    hooks: {
      init(_, build) {
        const { input } = build;
        const pgRegistry = (input as any).pgRegistry;

        if (!pgRegistry) {
          return _;
        }

        // Map all geometry and geography codecs to use the GeoJSON scalar type
        for (const codec of Object.values(
          pgRegistry.pgCodecs
        ) as PgCodec[]) {
          const extensions = codec.extensions as any;
          const isPostGIS =
            codec.name === "geometry" ||
            codec.name === "geography" ||
            extensions?.tags?.isPostGIS;

          if (isPostGIS) {
            // Map both input and output to GeoJSON scalar
            if (!(build as any).hasGraphQLTypeForPgCodec(codec, "output")) {
              (build as any).setGraphQLTypeForPgCodec(codec, "output", "GeoJSON");
            }
            if (!(build as any).hasGraphQLTypeForPgCodec(codec, "input")) {
              (build as any).setGraphQLTypeForPgCodec(codec, "input", "GeoJSON");
            }
          }
        }

        return _;
      },
    },
  },
};

