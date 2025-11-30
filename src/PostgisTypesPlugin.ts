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
  after: ["PostgisCodecPlugin", "PostgisScalarPlugin", "PostgisRegisterTypesPlugin"],

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

        // Get helper function from PostgisRegisterTypesPlugin
        const getPostGISGeometryType = (build as any).getPostGISGeometryType;
        if (!getPostGISGeometryType) {
          // PostgisRegisterTypesPlugin hasn't run yet, skip
          return _;
        }

        // Map all geometry and geography codecs to use GraphQL object types
        // The key insight: codecs for columns with specific modifiers (like geometry(point))
        // are stored in table codec attributes, not in the top-level registry.
        // We need to traverse all codecs, including those in attributes.
        
        const allCodecsSet = new Set<PgCodec>();
        
        // 1. Get codecs from pgCodecMetaLookup (most comprehensive source)
        const pgCodecMetaLookup = (build as any).pgCodecMetaLookup;
        if (pgCodecMetaLookup && pgCodecMetaLookup.keys) {
          for (const codec of pgCodecMetaLookup.keys()) {
            const pgCodec = codec as PgCodec;
            allCodecsSet.add(pgCodec);
            // Also add codecs from attributes (column codecs)
            if (pgCodec.attributes) {
              for (const attr of Object.values(pgCodec.attributes)) {
                const attrCodec = (attr as any).codec as PgCodec | undefined;
                if (attrCodec) {
                  allCodecsSet.add(attrCodec);
                }
              }
            }
          }
        }
        
        // 2. Also check pgRegistry.pgCodecs
        const registryCodecs = Object.values(pgRegistry.pgCodecs || {}) as PgCodec[];
        for (const codec of registryCodecs) {
          allCodecsSet.add(codec);
          if (codec.attributes) {
            for (const attr of Object.values(codec.attributes)) {
              const attrCodec = (attr as any).codec as PgCodec | undefined;
              if (attrCodec) {
                allCodecsSet.add(attrCodec);
              }
            }
          }
        }
        
        // 3. Check resources and their codecs
        const allResources = Object.values(pgRegistry.pgResources || {});
        for (const resource of allResources) {
          if ((resource as any).codec) {
            const tableCodec = (resource as any).codec as PgCodec;
            allCodecsSet.add(tableCodec);
            if (tableCodec.attributes) {
              for (const attr of Object.values(tableCodec.attributes)) {
                const attrCodec = (attr as any).codec as PgCodec | undefined;
                if (attrCodec) {
                  allCodecsSet.add(attrCodec);
                }
              }
            }
          }
        }
        
        const allCodecs = Array.from(allCodecsSet);
        console.log(`[PostgisTypesPlugin] Checking ${allCodecs.length} total codecs (including attributes)`);
        
        // Debug: List all codec names to see what we have
        const codecNames = allCodecs.map(c => c.name).filter((v, i, a) => a.indexOf(v) === i);
        console.log(`[PostgisTypesPlugin] Codec names found: ${codecNames.join(', ')}`);
        
        // Debug: Check table codecs specifically
        for (const resource of allResources) {
          if ((resource as any).codec) {
            const tableCodec = (resource as any).codec as PgCodec;
            if (tableCodec.attributes) {
              console.log(`[PostgisTypesPlugin] Table ${tableCodec.name} has ${Object.keys(tableCodec.attributes).length} attributes`);
              for (const [attrName, attr] of Object.entries(tableCodec.attributes)) {
                const attrCodec = (attr as any).codec as PgCodec | undefined;
                if (attrCodec) {
                  const attrExt = attrCodec.extensions as any;
                  if (attrCodec.name === "geometry" || attrCodec.name === "geography" || attrExt?.isPostGIS) {
                    console.log(`[PostgisTypesPlugin]   Attribute ${attrName}: codec=${attrCodec.name}, hasTypeDetails=${!!attrExt?.typeDetails}, typeDetails=`, attrExt?.typeDetails);
                  }
                }
              }
            }
          }
        }
        
        let mappedCount = 0;
        let postgisCodecCount = 0;
        for (const codec of allCodecs) {
          const extensions = codec.extensions as any;
          // Check if this is a PostGIS codec
          // Codec names can be:
          // - "geometry" or "geography" (unconstrained)
          // - "geometry_point_xy_4326", "geography_linestring_z_0", etc. (constrained with modifier)
          // - Or check extensions.isPostGIS flag
          const isPostGIS =
            codec.name === "geometry" ||
            codec.name === "geography" ||
            codec.name.startsWith("geometry_") ||
            codec.name.startsWith("geography_") ||
            extensions?.isPostGIS;

          if (isPostGIS) {
            postgisCodecCount++;
            // Get type details from codec extensions
            // typeDetails is stored directly in extensions.typeDetails (see codec.ts)
            const typeDetails = extensions?.typeDetails || null;
            
            console.log(`[PostgisTypesPlugin] Found PostGIS codec: name=${codec.name}, hasTypeDetails=${!!typeDetails}, typeDetails=`, typeDetails);
            if (typeDetails) {
              console.log(`[PostgisTypesPlugin]   subtype=${typeDetails.subtype}, hasZ=${typeDetails.hasZ}, hasM=${typeDetails.hasM}, srid=${typeDetails.srid}`);
            }

            // For input (mutations), use GeoJSON scalar
            if (!(build as any).hasGraphQLTypeForPgCodec(codec, "input")) {
              (build as any).setGraphQLTypeForPgCodec(codec, "input", "GeoJSON");
            }

            // For output (queries), use GraphQL object types
            if (!(build as any).hasGraphQLTypeForPgCodec(codec, "output")) {
              if (typeDetails && typeof typeDetails === 'object' && typeDetails.subtype !== undefined && typeDetails.subtype !== 0) {
                // Constrained geometry - use specific type
                // Extract base type name (geometry or geography) from codec name
                // Codec names are now like "geometry_point_xy_4326" or "geography_linestring_z_0"
                const baseTypeName = codec.name.startsWith("geography_") ? "geography" : "geometry";
                const typeName = getPostGISGeometryType(
                  baseTypeName,
                  typeDetails.subtype,
                  typeDetails.hasZ || false,
                  typeDetails.hasM || false
                );
                console.log(`[PostgisTypesPlugin]   Generated type name: ${typeName} for codec ${codec.name}`);
                if (typeName) {
                  (build as any).setGraphQLTypeForPgCodec(codec, "output", typeName);
                  mappedCount++;
                  console.log(`[PostgisTypesPlugin]   ✓ Mapped codec ${codec.name} to ${typeName}`);
                } else {
                  // Fallback to GeoJSON if type not found
                  console.log(`[PostgisTypesPlugin]   ✗ Type name is null, falling back to GeoJSON`);
                  (build as any).setGraphQLTypeForPgCodec(codec, "output", "GeoJSON");
                }
              } else {
                // Unconstrained geometry - use generic Geometry type that implements GeometryInterface
                // Extract base type name from codec name
                let baseTypeNameForUnconstrained = codec.name;
                if (codec.name.startsWith("geography_")) {
                  baseTypeNameForUnconstrained = "geography";
                } else if (codec.name.startsWith("geometry_")) {
                  baseTypeNameForUnconstrained = "geometry";
                }
                
                const geometryTypeName = getPostGISGeometryType(
                  baseTypeNameForUnconstrained,
                  0, // subtype 0 = generic geometry
                  false, // no Z
                  false  // no M
                );
                console.log(`[PostgisTypesPlugin]   Using generic Geometry type: ${geometryTypeName} for unconstrained codec ${codec.name}`);
                if (geometryTypeName) {
                  (build as any).setGraphQLTypeForPgCodec(codec, "output", geometryTypeName);
                  mappedCount++;
                } else {
                  console.log(`[PostgisTypesPlugin]   ✗ Type name is null, falling back to GeoJSON`);
                  (build as any).setGraphQLTypeForPgCodec(codec, "output", "GeoJSON");
                }
              }
            } else {
              const existingType = (build as any).getGraphQLTypeNameByPgCodec(codec, "output");
              console.log(`[PostgisTypesPlugin]   Codec ${codec.name} already has output type: ${existingType}`);
            }
          }
        }
        
        // Debug: Log how many codecs were mapped
        console.log(`[PostgisTypesPlugin] Found ${postgisCodecCount} PostGIS codecs, mapped ${mappedCount} to GraphQL object types`);

        return _;
      },
    },
  },
};

