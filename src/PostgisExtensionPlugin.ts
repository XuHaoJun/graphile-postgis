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

          // Find geometry and geography types in the same namespace
          // Access introspection via the helpers (pgIntrospection namespace)
          const introspection = await (info.helpers as any).pgIntrospection?.getIntrospection(
            serviceName
          );
          if (!introspection) {
            return;
          }
          // Get namespace using helpers
          const namespace = await (info.helpers as any).pgIntrospection?.getNamespace(
            serviceName,
            entity.extnamespace
          );
          if (namespace) {
            const geometryType = introspection.types.find(
              (t: PgType) =>
                t.typname === "geometry" &&
                t.getNamespace()?.nspname === namespace.nspname
            );
            const geographyType = introspection.types.find(
              (t: PgType) =>
                t.typname === "geography" &&
                t.getNamespace()?.nspname === namespace.nspname
            );

            if (geometryType) {
              info.state.geometryType = geometryType;
              debug(`Geometry type found: ${geometryType.typname}`);
            }
            if (geographyType) {
              info.state.geographyType = geographyType;
              debug(`Geography type found: ${geographyType.typname}`);
            }

            if (!geometryType || !geographyType) {
              console.warn(
                "PostGIS extension detected, but geometry/geography types not found. " +
                  "PostGIS types will be exposed as generic types."
              );
            }
          }
        }
      },
    },
  }),
};

