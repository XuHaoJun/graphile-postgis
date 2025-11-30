import type { GraphileConfig } from "graphile-config";
import { gatherConfig } from "graphile-build";
import type { GatherPluginContext } from "graphile-build";
import type { PgExtension, PgType } from "pg-introspection";
import debugFactory from "debug";

const debug = debugFactory("graphile-postgis:extension");

interface State {
  postgisExtension: PgExtension | null;
  geometryType: PgType | null;
  geographyType: PgType | null;
  postgisDetected: boolean;
}

declare global {
  namespace GraphileConfig {
    interface Plugins {
      PostgisExtensionPlugin: true;
    }
    interface GatherHelpers {
      postgis: {
        isPostGISAvailable(serviceName: string): boolean;
        getGeometryType(serviceName: string): PgType | null;
        getGeographyType(serviceName: string): PgType | null;
        getPostGISExtension(serviceName: string): PgExtension | null;
      };
    }
  }
}

export const PostgisExtensionPlugin: GraphileConfig.Plugin = {
  name: "PostgisExtensionPlugin",
  version: "0.1.0",

  gather: gatherConfig({
    namespace: "postgis",
    initialCache: (): Record<string, never> => ({}),
    initialState: (): State => ({
      postgisExtension: null,
      geometryType: null,
      geographyType: null,
      postgisDetected: false,
    }),
    helpers: {
      isPostGISAvailable(
        info: GatherPluginContext<State, Record<string, never>>,
        _serviceName: string
      ): boolean {
        // Check if PostGIS extension was detected for this service
        // For now, we check the first service's state
        // TODO: Support multiple services
        return info.state.postgisDetected;
      },
      getGeometryType(
        info: GatherPluginContext<State, Record<string, never>>,
        _serviceName: string
      ): PgType | null {
        return info.state.geometryType;
      },
      getGeographyType(
        info: GatherPluginContext<State, Record<string, never>>,
        _serviceName: string
      ): PgType | null {
        return info.state.geographyType;
      },
      getPostGISExtension(
        info: GatherPluginContext<State, Record<string, never>>,
        _serviceName: string
      ): PgExtension | null {
        return info.state.postgisExtension;
      },
    },
    hooks: {
      async pgIntrospection_extension(
        info: GatherPluginContext<State, Record<string, never>>,
        event: { entity: PgExtension; serviceName: string }
      ) {
        const { entity, serviceName } = event;
        if (entity.extname === "postgis") {
          debug(`PostGIS extension detected in service: ${serviceName}`);
          info.state.postgisExtension = entity;
          info.state.postgisDetected = true;
          // Types will be found via pgIntrospection_type hook
        }
      },
      async pgIntrospection_type(
        info: GatherPluginContext<State, Record<string, never>>,
        event: { entity: PgType; serviceName: string }
      ) {
        const { entity: pgType, serviceName } = event;
        
        // Early return if not geometry or geography
        if (pgType.typname !== "geometry" && pgType.typname !== "geography") {
          return;
        }

        // Get PostGIS extension dynamically - this works even though extension hook runs after type hook
        // because getExtensionByName accesses the introspection results which are already loaded
        const postgisExtension = await (info.helpers as any).pgIntrospection?.getExtensionByName(
          serviceName,
          "postgis"
        );

        if (!postgisExtension) {
          // PostGIS extension not found, skip this type
          return;
        }

        // Direct comparison of namespace IDs - same pattern as citext, hstore, ltree plugins
        // Compare namespace IDs directly (no need to get namespace objects)
        const namespaceMatches =
          String(pgType.typnamespace) === String(postgisExtension.extnamespace);

        if (namespaceMatches) {
          const namespace = pgType.getNamespace();
          if (pgType.typname === "geometry") {
            info.state.geometryType = pgType;
            debug(
              `Geometry type found: ${pgType.typname} (id: ${pgType._id}) in namespace ${namespace?.nspname || "unknown"}`
            );
          } else if (pgType.typname === "geography") {
            info.state.geographyType = pgType;
            debug(
              `Geography type found: ${pgType.typname} (id: ${pgType._id}) in namespace ${namespace?.nspname || "unknown"}`
            );
          }
        } else {
          debug(
            `Type ${pgType.typname} namespace mismatch: typnamespace=${pgType.typnamespace} vs extnamespace=${postgisExtension.extnamespace}`
          );
        }
      },
    },
  }),
};

