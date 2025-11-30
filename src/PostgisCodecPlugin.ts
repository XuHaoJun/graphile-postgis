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
          debug("PostGIS helpers not available");
          return; // PostGIS extension plugin not loaded
        }

        const isPostGISAvailable = postgisHelpers.isPostGISAvailable(serviceName);
        if (!isPostGISAvailable) {
          debug(`PostGIS not available for service: ${serviceName}`);
          return; // Let other plugins handle it
        }

        const geometryType = postgisHelpers.getGeometryType(serviceName);
        const geographyType = postgisHelpers.getGeographyType(serviceName);

        if (!geometryType || !geographyType) {
          debug(
            `PostGIS types not found - geometry: ${!!geometryType}, geography: ${!!geographyType}`
          );
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

        // Debug logging for geography type matching
        if (pgType.typname === "geography") {
          debug(
            `Checking geography type: namespace=${namespace?.nspname}, geographyNamespace=${geographyNamespace?.nspname}, typnamespace=${pgType.typnamespace}, geographyType.typnamespace=${geographyType.typnamespace}`
          );
        }

        // Check by both namespace name and namespace ID for robustness
        const isGeometryType =
          pgType.typname === "geometry" &&
          (namespace?.nspname === geometryNamespace?.nspname ||
            pgType.typnamespace === geometryType.typnamespace);

        const isGeographyType =
          pgType.typname === "geography" &&
          (namespace?.nspname === geographyNamespace?.nspname ||
            pgType.typnamespace === geographyType.typnamespace);

        if (isGeometryType) {
          debug(
            `Creating codec for geometry type (modifier: ${modifierNumber})`
          );
          const codec = createPostGISCodec(
            "geometry",
            modifierNumber,
            String(pgType.oid)
          );
          event.pgCodec = codec;
        } else if (isGeographyType) {
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

