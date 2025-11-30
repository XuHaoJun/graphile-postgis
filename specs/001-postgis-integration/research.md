# Research: PostGIS Integration with PostGraphile v5

**Date**: 2025-01-27  
**Feature**: PostGIS Integration  
**Status**: Complete

## Overview

This document consolidates research findings from analyzing:
1. The existing `@graphile/postgis` plugin (v4) implementation
2. PostGraphile v5 plugin architecture patterns (using `postgraphile-plugin-connection-filter` as reference)
3. PostGraphile v5 source code patterns and APIs

## Key Findings

### 1. PostGraphile v4 vs v5 Architecture Differences

#### V4 Architecture (Old PostGIS Plugin)
- **Plugin Type**: Function-based schema plugins using `graphile-build` hooks
- **Type System**: Ad-hoc type creation using `newWithHooks()` during schema build
- **Data Flow**: Lookahead engine with `QueryBuilder` and data generators
- **Resolvers**: Traditional GraphQL resolvers with `resolve` functions
- **SQL Generation**: `pgTweaksByTypeIdAndModifer` for SQL fragment generation
- **Type Registration**: `pgRegisterGqlTypeByTypeId` and `pgRegisterGqlInputTypeByTypeId`

#### V5 Architecture (Target)
- **Plugin Type**: Graphile Config plugin objects with `name`, `version`, `description`
- **Type System**: Type registration during `init` hook using `registerObjectType`, `registerScalarType`, etc.
- **Data Flow**: Grafast planning and execution engine (no lookahead)
- **Resolvers**: Grafast plan resolvers (not traditional resolvers)
- **SQL Generation**: Codec-based system with `PgCodec` for type handling
- **Type Registration**: Must register all types during `init` phase before use

### 2. V4 PostGIS Plugin Structure Analysis

The v4 plugin consists of multiple sub-plugins:

1. **PostgisVersionPlugin**: Checks PostGIS version (not critical for v5)
2. **PostgisInflectionPlugin**: Adds inflection functions for naming GIS types
3. **PostgisExtensionDetectionPlugin**: Detects PostGIS extension and geometry/geography types
4. **PostgisRegisterTypesPlugin**: Core plugin that:
   - Registers GeoJSON scalar type
   - Creates GraphQL interfaces for geometry types
   - Creates GraphQL object types for each geometry subtype
   - Registers input/output type mappings
   - Handles SQL generation for queries (using `pgTweaksByTypeIdAndModifer`)
   - Handles mutation input (using `pg2GqlMapper`)

5. **Type-Specific Enhancement Plugins**:
   - `Postgis_Point_LatitudeLongitudePlugin`: Adds x/y/z fields to Point types
   - `Postgis_LineString_PointsPlugin`: Adds points array to LineString
   - `Postgis_Polygon_RingsPlugin`: Adds exterior/interiors to Polygon
   - `Postgis_MultiPoint_PointsPlugin`: Adds points array to MultiPoint
   - `Postgis_MultiLineString_LineStringsPlugin`: Adds lineStrings array
   - `Postgis_MultiPolygon_PolygonsPlugin`: Adds polygons array
   - `Postgis_GeometryCollection_GeometriesPlugin`: Adds geometries array

#### Key V4 Patterns to Migrate:

**SQL Generation Pattern**:
```typescript
pgTweaksByTypeIdAndModifer[typeId][typeModifierKey] = (fragment: SQL) => {
  return sql.fragment`(case when ${fragment} is null then null else json_build_object(
    ${sql.literal("__gisType")}, ${postgis_type_name_function}(${fragment}),
    ${sql.literal("__srid")}, ${st_srid_function}(${fragment}),
    ${sql.literal("__geojson")}, ${st_asgeojson_function}(${fragment})::JSON
  ) end)`;
};
```

**Input/Output Mapping Pattern**:
```typescript
pgRegisterGqlInputTypeByTypeId(GEOMETRY_TYPE.id, () => GeoJSON);
pg2GqlMapper[GEOMETRY_TYPE.id] = {
  map: identity,
  unmap: (o: any) => sql.fragment`st_geomfromgeojson(${sql.value(JSON.stringify(o))}::text)`
};
```

### 3. V5 Plugin Architecture Patterns

#### Plugin Structure (from connection-filter example):
```typescript
export const MyPlugin: GraphileConfig.Plugin = {
  name: "MyPlugin",
  version: "1.0.0",
  description: "Plugin description",
  after: ["RequiredPlugin"], // Dependencies
  before: ["LaterPlugin"],    // Ordering
  provides: ["feature-name"],  // Features this provides
  
  schema: {
    hooks: {
      build(build) {
        // Add build-time helpers
        return build;
      },
      init: {
        after: ["PgCodecs"], // Run after codecs are registered
        callback(_, build) {
          // Register types, add helpers
          return _;
        },
      },
      GraphQLObjectType_fields(fields, build, context) {
        // Modify fields
        return fields;
      },
    },
  },
};
```

#### Type Registration Pattern:
```typescript
// During init hook
build.registerScalarType(
  "GeoJSON",
  { /* scope */ },
  () => ({
    name: "GeoJSON",
    description: "...",
    serialize: ...,
    parseValue: ...,
    parseLiteral: ...,
  }),
  "PostGIS plugin"
);

build.registerObjectType(
  "GeometryPoint",
  { isPgGISType: true, pgGISType: geometryType },
  () => ({
    name: "GeometryPoint",
    fields: {
      geojson: { type: GeoJSON },
      srid: { type: GraphQLNonNull(GraphQLInt) },
    },
  }),
  "PostGIS plugin"
);
```

#### Codec-Based Type Handling:
V5 uses `PgCodec` system for PostgreSQL type handling:
- Codecs represent database types
- Codecs handle `toPg` (JavaScript → PostgreSQL) and `fromPg` (PostgreSQL → JavaScript)
- Codecs can have custom SQL casting via `castFromPg`
- Custom codecs can be registered via `gather.hooks.pgCodecs_findPgCodec`

#### Field Addition Pattern:
```typescript
GraphQLObjectType_fields(fields, build, context) {
  const { scope, Self } = context;
  if (!scope.isPgGISType) return fields;
  
  return build.extend(fields, {
    x: {
      type: GraphQLNonNull(GraphQLFloat),
      plan: ($row) => {
        // Grafast plan resolver
        return $row.select(sql`st_x(${$row})`, TYPES.float);
      },
    },
  });
}
```

### 4. Key Technical Decisions

#### Decision 1: PostGIS Detection Strategy
**Chosen**: Warning-based graceful degradation  
**Rationale**: 
- V4 plugin silently skips if PostGIS not found
- Spec requires warning but continue
- Allows plugin to be included even when PostGIS unavailable
- Prevents deployment failures

**Implementation**: Check for PostGIS extension during `gather` phase, log warning if missing, continue with schema build

#### Decision 2: Type Registration Approach
**Chosen**: Register all geometry types during `init` hook  
**Rationale**:
- V5 requires all types registered before use
- Cannot use ad-hoc `newWithHooks()` pattern from v4
- Must register types by name during `init` phase
- Types created lazily but names must be registered

**Implementation**: 
- Register GeoJSON scalar during `init`
- Register all geometry GraphQL types (Point, LineString, etc.) during `init`
- Use scope-based hooks to add type-specific fields

#### Decision 3: Codec vs Direct Type Mapping
**Chosen**: Hybrid approach - Custom codec for geometry/geography types  
**Rationale**:
- V5 uses codec system for PostgreSQL type handling
- Codecs handle input/output transformation
- Codecs can generate custom SQL for queries
- Codecs handle mutation input transformation

**Implementation**:
- Create custom `PgCodec` for geometry/geography types during `gather` phase
- Codec handles `toPg` (GeoJSON → PostGIS) with SRID transformation
- Codec handles `fromPg` (PostGIS → GeoJSON) with type detection
- Codec generates SQL for querying (ST_AsGeoJSON, ST_SRID, etc.)

#### Decision 4: Dynamic Type Detection for Unconstrained Geometry
**Chosen**: Runtime type detection using PostGIS functions  
**Rationale**:
- Spec requires detecting actual type at query time
- Unconstrained geometry columns can contain mixed types
- Each row may return different GraphQL type
- PostGIS provides `geometrytype()` function for detection

**Implementation**:
- Use PostGIS `geometrytype()` function in SQL
- Use GraphQL union type or interface with `resolveType`
- Or use codec that returns different GraphQL types based on actual geometry type

#### Decision 5: SRID Transformation in Mutations
**Chosen**: Automatic transformation using `ST_Transform`  
**Rationale**:
- Spec requires automatic coordinate transformation
- PostGIS provides `ST_Transform` function
- Better developer experience than manual transformation
- Handles common case of GeoJSON (SRID 4326) to different column SRIDs

**Implementation**:
- In codec `toPg` method, detect SRID from GeoJSON (default 4326 per RFC 7946)
- Compare with column SRID from type modifier
- If different, wrap with `ST_Transform(geometry, target_srid)`

#### Decision 6: GeoJSON Validation
**Chosen**: Validate in codec `toPg` with detailed error messages  
**Rationale**:
- Spec requires specific validation errors
- Codec `toPg` is natural place for validation
- Can provide field-level error details
- Throws errors that Grafast will surface to GraphQL

**Implementation**:
- Validate GeoJSON structure (type, coordinates, etc.)
- Check coordinate arrays match geometry type
- Provide specific error messages with field names and issues
- Use GraphQL error format for consistency

### 5. Migration Strategy from V4 to V5

#### Phase 1: Core Type Registration
- Migrate `PostgisExtensionDetectionPlugin` → `gather` hook
- Migrate `PostgisRegisterTypesPlugin` → `init` hook with type registration
- Create custom codec for geometry/geography types
- Register GeoJSON scalar type

#### Phase 2: Query Support
- Migrate SQL generation from `pgTweaksByTypeIdAndModifer` → codec `fromPg` and field plans
- Create GraphQL types for each geometry subtype
- Add GeoJSON and SRID fields to all types
- Handle dynamic type detection for unconstrained geometry

#### Phase 3: Mutation Support
- Migrate input mapping from `pg2GqlMapper` → codec `toPg`
- Add SRID transformation logic
- Add GeoJSON validation with detailed errors

#### Phase 4: Type-Specific Fields
- Migrate enhancement plugins → `GraphQLObjectType_fields` hooks
- Add x/y/z fields to Point types
- Add coordinate arrays to LineString/Polygon
- Add collection fields to Multi* and GeometryCollection types

### 6. Dependencies and Requirements

#### Required Packages:
- `postgraphile` (v5+)
- `graphile-build` (v5+)
- `graphile-build-pg` (v5+)
- `@dataplan/pg` (for PgCodec)
- `grafast` (for plan resolvers)
- `pg-sql2` (for SQL generation)
- `graphql` (v16+)

#### PostGIS Functions Used:
- `geometrytype(geometry)` - Get geometry type name
- `st_srid(geometry)` - Get SRID
- `st_asgeojson(geometry)` - Convert to GeoJSON
- `st_geomfromgeojson(text)` - Convert from GeoJSON
- `st_transform(geometry, srid)` - Transform coordinates
- `st_coorddim(geometry)` - Get coordinate dimensions (Z/M)
- `st_x(point)`, `st_y(point)`, `st_z(point)` - Get coordinates
- `st_dumppoints(geometry)` - Get all points from geometry

### 7. Performance Considerations

#### Large Geometry Handling:
- Spec requires handling all sizes with warnings
- Monitor serialized GeoJSON size
- Log warnings for geometries > 1MB
- Consider streaming for very large geometries (future enhancement)

#### Query Optimization:
- Use PostGIS functions efficiently
- Avoid N+1 queries when accessing nested geometry properties
- Leverage Grafast's planning for query optimization
- Consider caching geometry type detection for unconstrained columns

### 8. Testing Strategy

#### Unit Tests:
- Test codec `toPg` and `fromPg` methods
- Test GeoJSON validation
- Test SRID transformation
- Test type detection logic

#### Integration Tests:
- Test with actual PostgreSQL + PostGIS database
- Test all geometry types (Point, LineString, Polygon, etc.)
- Test mutations with various SRIDs
- Test unconstrained geometry columns
- Test null handling
- Test error cases (invalid GeoJSON, missing PostGIS, etc.)

#### Snapshot Tests:
- GraphQL schema snapshots for all geometry types
- Query result snapshots
- Error message snapshots

## Alternatives Considered

### Alternative 1: Direct SQL Fragment Approach (Rejected)
**Approach**: Generate SQL fragments directly without codec system  
**Why Rejected**: 
- V5 architecture strongly favors codec-based approach
- Codecs provide better type safety and validation
- Codecs handle both queries and mutations uniformly
- Better integration with PostGraphile v5 type system

### Alternative 2: Union Types for Unconstrained Geometry (Rejected)
**Approach**: Use GraphQL union type for unconstrained geometry columns  
**Why Rejected**:
- Spec requires dynamic type detection per row
- Union types are static and don't support per-row type selection
- Interface with `resolveType` provides better flexibility
- Matches v4 plugin's approach more closely

### Alternative 3: Reject SRID Mismatches (Rejected)
**Approach**: Return validation error when SRID doesn't match  
**Why Rejected**:
- Spec explicitly requires automatic transformation
- Better developer experience
- PostGIS transformation is reliable and well-tested
- Common use case (GeoJSON is always 4326 per RFC 7946)

## Open Questions Resolved

1. ✅ **PostGIS missing behavior**: Warning and graceful degradation
2. ✅ **SRID mismatch**: Automatic transformation
3. ✅ **Error message detail**: Specific validation errors
4. ✅ **Unconstrained geometry**: Dynamic type detection
5. ✅ **Large geometries**: Handle all sizes with warnings

## Next Steps

1. Create custom `PgCodec` for geometry/geography types
2. Register GeoJSON scalar type
3. Register all geometry GraphQL types
4. Implement codec `toPg` with validation and SRID transformation
5. Implement codec `fromPg` with type detection
6. Add type-specific fields via hooks
7. Write comprehensive tests

## References

- [PostGraphile v5 Migration Guide](https://www.graphile.org/postgraphile/5/migrating-from-v4/)
- [Graphile Build v5 Plugins](https://build.graphile.org/graphile-build/5/plugins)
- [Grafast Documentation](https://grafast.org/grafast/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [GeoJSON RFC 7946](https://tools.ietf.org/html/rfc7946)
- V4 PostGIS Plugin: `/learn-projects/postgis/src/`
- V5 Connection Filter Plugin: `/learn-projects/postgraphile-plugin-connection-filter/src/`

