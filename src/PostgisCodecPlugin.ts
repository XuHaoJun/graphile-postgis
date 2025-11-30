import type { GraphileConfig } from "graphile-config";
import { gatherConfig } from "graphile-build";
import type { GatherPluginContext } from "graphile-build";
import { createPostGISCodec } from "./codec";
import debugFactory from "debug";

const debug = debugFactory("graphile-postgis:codec");
const { version } = require("../package.json");

interface State {}
interface Cache {}

declare global {
  namespace GraphileConfig {
    interface GatherHelpers {
      postgisCodec: Record<string, never>;
    }
  }
}

export const PostgisCodecPlugin: GraphileConfig.Plugin = {
  name: "PostgisCodecPlugin",
  version,
  after: ["PostgisExtensionPlugin"],

  gather: gatherConfig({
    namespace: "postgisCodec",
    initialCache: (): Cache => ({}),
    initialState: (): State => ({}),
    helpers: {},
    hooks: {
      async pgCodecs_findPgCodec(
        info: GatherPluginContext<State, Cache>,
        event: {
          serviceName: string;
          pgCodec: any;
          pgType: any;
          typeModifier: string | number | null | undefined;
        }
      ) {
        const { pgType, typeModifier, serviceName } = event;

        // Check if PostGIS is available - access helpers from postgis namespace
        const postgisHelpers = (info.helpers as any).postgis;
        if (!postgisHelpers) {
          return; // PostGIS extension plugin not loaded
        }

        const isPostGISAvailable = postgisHelpers.isPostGISAvailable(serviceName);
        if (!isPostGISAvailable) {
          return; // Let other plugins handle it
        }

        const geometryType = postgisHelpers.getGeometryType(serviceName);
        const geographyType = postgisHelpers.getGeographyType(serviceName);

        if (!geometryType || !geographyType) {
          return; // PostGIS types not found
        }

        // Check if this is a geometry or geography type
        const namespace = pgType.getNamespace();
        const geometryNamespace = geometryType.getNamespace();
        const geographyNamespace = geographyType.getNamespace();

        // Convert typeModifier to number if it's a string
        const modifierNumber =
          typeof typeModifier === "string"
            ? parseInt(typeModifier, 10) || null
            : typeModifier ?? null;

        if (
          pgType.typname === "geometry" &&
          namespace?.nspname === geometryNamespace?.nspname
        ) {
          debug(
            `Creating codec for geometry type (modifier: ${modifierNumber})`
          );
          const codec = createPostGISCodec(
            "geometry",
            modifierNumber,
            String(pgType.oid)
          );
          event.pgCodec = codec;
        } else if (
          pgType.typname === "geography" &&
          namespace?.nspname === geographyNamespace?.nspname
        ) {
          debug(
            `Creating codec for geography type (modifier: ${modifierNumber})`
          );
          const codec = createPostGISCodec(
            "geography",
            modifierNumber,
            String(pgType.oid)
          );
          event.pgCodec = codec;
        }
      },
    },
  }),
};

