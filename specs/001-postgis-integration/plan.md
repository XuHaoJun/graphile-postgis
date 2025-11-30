# Implementation Plan: PostGIS Integration with PostGraphile v5

**Branch**: `001-postgis-integration` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-postgis-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a PostGraphile v5 plugin that provides PostGIS spatial data support for PostgreSQL databases. The plugin will enable GraphQL queries and mutations for PostGIS geometry and geography columns, supporting all geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection) with GeoJSON input/output format. The implementation will use PostGraphile v5's codec-based architecture with custom `PgCodec` for geometry types, Grafast plan resolvers for field resolution, and automatic SRID transformation for mutations. The plugin will gracefully handle missing PostGIS extension with warnings and support dynamic type detection for unconstrained geometry columns.

## Technical Context

**Language/Version**: TypeScript 5.0+  
**Primary Dependencies**: 
- `postgraphile` (v5.0.0-rc.1+)
- `graphile-build` (v5.0.0-rc.1+)
- `graphile-build-pg` (v5.0.0-rc.1+)
- `@dataplan/pg` (v1.0.0-rc.1+)
- `grafast` (v1.0.0-rc.1+)
- `pg-sql2` (v5.0.0+)
- `graphql` (v16.9.0+)

**Storage**: PostgreSQL with PostGIS extension (2.5+)  
**Testing**: Jest with ts-jest, snapshot tests for GraphQL schema, integration tests with Docker PostGIS database  
**Test Database**: Docker Compose setup with `postgis/postgis:18-3.6-alpine` image (see `docker-compose.yaml`)  
**Target Platform**: Node.js (server-side PostGraphile plugin)  
**Project Type**: Single npm package (PostGraphile schema plugin)  
**Performance Goals**: 
- Query response time < 500ms for typical queries (tables < 10,000 rows)
- Handle all geometry sizes (warn for > 1MB serialized)
- No significant overhead beyond PostGraphile baseline

**Constraints**: 
- Must work with PostGraphile v5 only (no v4 compatibility)
- Must gracefully handle missing PostGIS extension
- Must support all PostGIS geometry subtypes
- Must comply with GeoJSON RFC 7946 specification
- TypeScript strict mode enabled
- Zero linting warnings

**Scale/Scope**: 
- Single npm package (~15-20 source files)
- Support for 7 geometry subtypes
- Support for geometry and geography types
- Support for XY, XYZ, XYM, XYZM coordinate dimensions

## Testing Infrastructure

### Test Database Setup

The project includes a Docker Compose configuration (`docker-compose.yaml`) with a PostGIS-enabled PostgreSQL database for integration testing.

**Database Configuration**:
- Image: `postgis/postgis:18-3.6-alpine` (PostgreSQL 18 with PostGIS 3.6)
- Port: `5432:5432`
- Password: `test` (as configured in docker-compose.yaml)
- Shared memory: 128MB (required for PostGIS)

**Setup Steps**:

1. Start the test database:
   ```bash
   docker-compose up -d db
   ```

2. Create test database and enable PostGIS:
   ```bash
   # Connect to default postgres database
   psql -h localhost -U postgres -d postgres -c "CREATE DATABASE graphile_test;"
   psql -h localhost -U postgres -d graphile_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

3. Set environment variable for tests:
   ```bash
   export TEST_DATABASE_URL=postgres://postgres:test@localhost:5432/graphile_test
   ```

**Test Scripts**:

- Test script should check for `TEST_DATABASE_URL` environment variable
- Test script should load `__tests__/fixtures/schema.sql` to initialize test schema
- Integration tests require database connection to test actual PostGIS functions
- Unit tests can run without database (test codec methods, validation, utils in isolation)

**Test Database Schema**:

The test schema (`__tests__/fixtures/schema.sql`) should include:
- Tables with various geometry types (Point, LineString, Polygon, etc.)
- Tables with different SRIDs
- Tables with Z and M coordinates
- Unconstrained geometry columns (for dynamic type detection tests)
- Null geometry columns (for null handling tests)

**CI/CD Considerations**:

- Docker Compose database can be used in CI/CD pipelines
- Alternative: Use service containers in GitHub Actions / GitLab CI
- Ensure PostGIS extension is available in all test environments

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality (NON-NEGOTIABLE)
✅ **PASS**: TypeScript strict mode will be enabled. Code will follow PostGraphile v5 plugin patterns. Linting (prettier, eslint) with zero warnings required.

### II. Testing Standards (NON-NEGOTIABLE)
✅ **PASS**: Tests will be written before implementation (TDD preferred). Unit tests for codec methods, integration tests with actual PostgreSQL+PostGIS database, snapshot tests for GraphQL schema. Test coverage for all public APIs and plugin entry points.

### III. User Experience Consistency
✅ **PASS**: GraphQL API will follow PostGraphile v5 conventions. GeoJSON format will comply with RFC 7946. Error messages will be clear and actionable. API responses will maintain consistent structure across all PostGIS geometry types.

### IV. Performance Requirements
✅ **PASS**: Schema generation will complete within acceptable time limits. GraphQL query execution will not introduce significant overhead. Database queries will be optimized to avoid N+1 problems. Memory usage will remain reasonable for large geometry collections.

**Status**: All constitution gates pass. Ready to proceed with implementation.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts                    # Main plugin export
├── PostgisExtensionPlugin.ts   # PostGIS extension detection (gather phase)
├── PostgisCodecPlugin.ts      # Custom codec for geometry/geography types
├── PostgisTypesPlugin.ts      # GraphQL type registration (init phase)
├── PostgisScalarPlugin.ts     # GeoJSON scalar type registration
├── PostgisFieldPlugins.ts     # Type-specific field additions
│   ├── PostgisPointFieldsPlugin.ts
│   ├── PostgisLineStringFieldsPlugin.ts
│   ├── PostgisPolygonFieldsPlugin.ts
│   ├── PostgisMultiPointFieldsPlugin.ts
│   ├── PostgisMultiLineStringFieldsPlugin.ts
│   ├── PostgisMultiPolygonFieldsPlugin.ts
│   └── PostgisGeometryCollectionFieldsPlugin.ts
├── inflection.ts              # Inflection functions for naming
├── codec.ts                    # Custom PgCodec implementation
├── validation.ts               # GeoJSON validation
├── utils.ts                    # Utility functions (type detection, SRID handling)
├── constants.ts                # Geometry type constants
└── types.ts                    # TypeScript type definitions

__tests__/
├── unit/
│   ├── codec.test.ts
│   ├── validation.test.ts
│   └── utils.test.ts
├── integration/
│   ├── schema.test.ts
│   ├── queries.test.ts
│   └── mutations.test.ts
├── fixtures/
│   ├── schema.sql              # Test database schema
│   └── queries/                # GraphQL query fixtures
└── __snapshots__/
    └── schema.test.ts.snap     # GraphQL schema snapshots

scripts/
└── test                        # Test runner script (checks TEST_DATABASE_URL, loads schema.sql)

docker-compose.yaml             # Test database configuration (PostGIS 18-3.6)
```

**Structure Decision**: Single npm package structure following PostGraphile v5 plugin conventions. Source code in `src/` directory with modular plugin files. Tests in `__tests__/` with unit, integration, and snapshot tests. Follows patterns from `postgraphile-plugin-connection-filter` example.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
