import type { GraphileConfig } from "graphile-config";
import { gatherConfig } from "graphile-build";
import type { GatherPluginContext } from "graphile-build";
import { createPostGISCodec } from "./codec";
import debugFactory from "debug";

const debug = debugFactory("graphile-postgis:codec");
const { version } = require("../package.json");

interface State {
  codecByModifier: Map<string, Map<string, any>>; // serviceName -> "typeName_modifier" -> codec
}

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
    initialState: (): State => ({
      codecByModifier: new Map(),
    }),
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
          
          // Store codec by type and modifier so we can retrieve it later for attributes
          let serviceMap = info.state.codecByModifier.get(serviceName);
          if (!serviceMap) {
            serviceMap = new Map();
            info.state.codecByModifier.set(serviceName, serviceMap);
          }
          const key = `geometry_${modifierNumber ?? -1}`;
          serviceMap.set(key, codec);
          
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
          
          // Store codec by type and modifier so we can retrieve it later for attributes
          let serviceMap = info.state.codecByModifier.get(serviceName);
          if (!serviceMap) {
            serviceMap = new Map();
            info.state.codecByModifier.set(serviceName, serviceMap);
          }
          const key = `geography_${modifierNumber ?? -1}`;
          serviceMap.set(key, codec);
          
          event.pgCodec = codec;
        }
      },
      
      // Hook into attribute creation to replace codecs with the correct modifier-specific ones
      // This is necessary because PostGraphile caches codecs by typeId only, not by typeId + modifier,
      // so all columns with the same base type get the same cached codec (usually the unconstrained one).
      async pgCodecs_attribute(info: any, event: any) {
        const { attribute, pgAttribute, serviceName } = event;
        const attributeCodec = attribute.codec;
        
        // Check if this is a PostGIS codec (but might be the wrong one due to caching)
        const extensions = attributeCodec?.extensions as any;
        const isPostGIS =
          attributeCodec?.name === "geometry" ||
          attributeCodec?.name === "geography" ||
          attributeCodec?.name?.startsWith("geometry_") ||
          attributeCodec?.name?.startsWith("geography_") ||
          extensions?.isPostGIS;
        
        if (!isPostGIS) {
          return; // Not a PostGIS codec
        }
        
        // Get the actual modifier for this attribute
        const actualModifier = pgAttribute.atttypmod;
        const modifierNumber =
          typeof actualModifier === "string"
            ? parseInt(actualModifier, 10) || null
            : actualModifier ?? null;
        
        debug(
          `pgCodecs_attribute: attribute=${pgAttribute.attname}, currentCodec=${attributeCodec?.name}, modifier=${modifierNumber}`
        );
        
        // Determine the base type name (geometry or geography)
        const pgType = pgAttribute.getType();
        if (!pgType) {
          debug(`pgCodecs_attribute: No pgType for attribute ${pgAttribute.attname}`);
          return;
        }
        const postgisHelpers = (info.helpers as any).postgis;
        if (!postgisHelpers) {
          debug(`pgCodecs_attribute: No postgis helpers for attribute ${pgAttribute.attname}`);
          return;
        }
        const geometryType = postgisHelpers.getGeometryType(serviceName);
        const geographyType = postgisHelpers.getGeographyType(serviceName);
        if (!geometryType || !geographyType) {
          debug(`pgCodecs_attribute: No geometry/geography types for attribute ${pgAttribute.attname}`);
          return;
        }
        
        const isGeometry = pgType.typname === "geometry" && 
          (pgType.typnamespace === geometryType.typnamespace);
        const isGeography = pgType.typname === "geography" && 
          (pgType.typnamespace === geographyType.typnamespace);
        
        if (!isGeometry && !isGeography) {
          debug(`pgCodecs_attribute: Not geometry or geography for attribute ${pgAttribute.attname}`);
          return;
        }
        
        const baseTypeName = isGeometry ? "geometry" : "geography";
        
        // If modifier is -1 or null, the unconstrained codec is correct
        if (modifierNumber === null || modifierNumber === -1) {
          debug(`pgCodecs_attribute: Modifier is -1/null for ${pgAttribute.attname}, keeping unconstrained codec`);
          return; // Already has the correct codec
        }
        
        // Get or create the correct codec for this type and modifier
        let serviceMap = info.state.codecByModifier.get(serviceName);
        if (!serviceMap) {
          serviceMap = new Map();
          info.state.codecByModifier.set(serviceName, serviceMap);
        }
        
        const key = `${baseTypeName}_${modifierNumber}`;
        let correctCodec = serviceMap.get(key);
        
        // If codec doesn't exist yet, create it now
        if (!correctCodec) {
          debug(`pgCodecs_attribute: Creating codec on-demand for ${pgAttribute.attname} with modifier ${modifierNumber}`);
          correctCodec = createPostGISCodec(
            baseTypeName as "geometry" | "geography",
            modifierNumber,
            String(pgType._id)
          );
          serviceMap.set(key, correctCodec);
        }
        
        if (correctCodec && correctCodec !== attributeCodec) {
          debug(
            `Replacing codec for attribute ${pgAttribute.attname}: ${attributeCodec.name} -> ${correctCodec.name} (modifier: ${modifierNumber})`
          );
          attribute.codec = correctCodec;
        } else {
          debug(`pgCodecs_attribute: Codec already correct for ${pgAttribute.attname}`);
        }
      },
    },
  }),
};

