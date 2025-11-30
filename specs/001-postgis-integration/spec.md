# Feature Specification: PostGIS Integration with PostGraphile v5

**Feature Branch**: `001-postgis-integration`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "postgis integrate postgraphile"

## Clarifications

### Session 2025-01-27

- Q: When PostGIS extension is not detected, should the plugin fail silently, fail loudly, or provide a warning but continue? → A: Warning only - log warning but continue, expose PostGIS types as generic types
- Q: When a mutation provides GeoJSON with a different SRID than the column expects, should the system automatically transform, reject, or accept as-is? → A: Automatically transform coordinates to match column SRID using PostGIS transformation
- Q: When GeoJSON validation fails, what level of detail should error messages provide? → A: Include specific validation errors (field names, coordinate issues, type mismatches)
- Q: How should unconstrained geometry columns (allowing mixed geometry types) be handled in GraphQL schema? → A: Detect actual type at query time and return appropriate GraphQL type dynamically per row
- Q: How should very large geometries be handled for performance? → A: Handle all sizes, log warnings for very large geometries (e.g., > 1MB serialized) to alert developers to potential performance issues

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Query PostGIS Data from GraphQL API (Priority: P1)

A developer using PostGraphile v5 with a PostgreSQL database containing PostGIS spatial data wants to query that spatial data through GraphQL. They have tables with geometry or geography columns and need to retrieve spatial information in a format that can be consumed by mapping applications and geospatial tools.

**Why this priority**: This is the core functionality - without the ability to query PostGIS data, the plugin provides no value. This must work before any other features can be useful.

**Independent Test**: Can be fully tested by creating a database table with a PostGIS geometry column, running PostGraphile v5 with this plugin enabled, and successfully executing a GraphQL query that retrieves the spatial data in GeoJSON format. The test delivers immediate value by enabling spatial data access.

**Acceptance Scenarios**:

1. **Given** a PostgreSQL database with PostGIS extension enabled and a table containing a `geometry(Point, 4326)` column, **When** a developer queries that column through GraphQL, **Then** the query returns spatial data in a structured format (GeoJSON) that can be consumed by mapping libraries
2. **Given** a table with multiple PostGIS columns of different geometry types (Point, LineString, Polygon), **When** querying all columns in a single GraphQL query, **Then** each column returns appropriately typed spatial data
3. **Given** a table with a PostGIS column containing null values, **When** querying that column, **Then** null values are handled gracefully without errors

---

### User Story 2 - Create and Update PostGIS Data via Mutations (Priority: P2)

A developer wants to create new records or update existing records with spatial data through GraphQL mutations. They need to provide spatial data in GeoJSON format and have it properly stored in PostgreSQL PostGIS columns.

**Why this priority**: While querying is essential, the ability to create and update spatial data is critical for most applications. This enables full CRUD operations on spatial data.

**Independent Test**: Can be fully tested by executing a GraphQL mutation to create a new record with PostGIS data provided as GeoJSON, then verifying the data was correctly stored in the database. This delivers value by enabling spatial data creation and modification.

**Acceptance Scenarios**:

1. **Given** a table with a `geometry(Point, 4326)` column, **When** a developer creates a new record via GraphQL mutation with GeoJSON Point data, **Then** the record is created with the spatial data correctly stored in the PostGIS column
2. **Given** an existing record with PostGIS data, **When** updating that record's spatial column via GraphQL mutation with new GeoJSON data, **Then** the spatial data is updated correctly
3. **Given** a mutation that sets a PostGIS column to null, **When** executing the mutation, **Then** the column is set to null without errors

---

### User Story 3 - Access Spatial Metadata and Coordinates (Priority: P2)

A developer needs to access spatial metadata (like SRID) and coordinate values directly from GraphQL queries, not just the raw GeoJSON. This enables applications to work with spatial data without parsing GeoJSON.

**Why this priority**: Many applications need direct access to coordinates (latitude/longitude) and spatial reference information. This provides a more convenient API than requiring clients to parse GeoJSON.

**Independent Test**: Can be fully tested by querying a Point geometry column and verifying that fields like `latitude`, `longitude`, and `srid` are available and return correct values. This delivers value by providing convenient access to spatial properties.

**Acceptance Scenarios**:

1. **Given** a table with a `geometry(Point, 4326)` column, **When** querying that column, **Then** fields for `x` (longitude), `y` (latitude), and `srid` are available and return correct values
2. **Given** a table with a `geometry(Point, 4326)` column that has Z coordinates, **When** querying that column, **Then** a `z` field is available and returns the elevation value
3. **Given** a table with a `geometry(LineString)` column, **When** querying that column, **Then** a field is available that returns an array of coordinate pairs representing the line's points

---

### User Story 4 - Support Multiple Geometry Types (Priority: P3)

A developer has a database with various PostGIS geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection) and needs all of them to be properly exposed in the GraphQL schema with appropriate type-specific fields.

**Why this priority**: While Point support covers many use cases, full PostGIS support requires handling all geometry types. This provides comprehensive spatial data support.

**Independent Test**: Can be fully tested by creating tables with different geometry types and verifying each type is correctly exposed in the GraphQL schema with appropriate fields. This delivers value by supporting the full range of PostGIS capabilities.

**Acceptance Scenarios**:

1. **Given** tables with different geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection), **When** querying the GraphQL schema, **Then** each geometry type has appropriate GraphQL types with type-specific fields
2. **Given** a table with a `geometry(GeometryCollection)` column, **When** querying that column, **Then** a field is available that returns the list of geometries within the collection
3. **Given** a table with a `geometry(Polygon)` column, **When** querying that column, **Then** a field is available that returns the polygon's rings (exterior and interior boundaries)

---

### Edge Cases

- What happens when PostGIS extension is not installed in the database? **Answer**: System logs a warning during schema build and continues, exposing geometry/geography columns as generic types without PostGIS-specific functionality
- How does the system handle geometry columns with different SRIDs?
- What happens when invalid GeoJSON is provided in a mutation?
- How does the system handle geometry columns with Z or M coordinates?
- What happens when querying a geometry column that contains mixed geometry types (unconstrained geometry)? **Answer**: System detects the actual geometry type at query time for each row and returns the appropriate GraphQL type dynamically, allowing different rows to return different geometry subtypes
- How does the system handle very large geometries that might cause performance issues? **Answer**: System handles all geometry sizes without rejection, but logs warnings for very large geometries (e.g., > 1MB when serialized) to alert developers to potential performance concerns
- What happens when a mutation provides GeoJSON with a different SRID than the column expects? **Answer**: System automatically transforms coordinates to match the column's SRID using PostGIS coordinate transformation functions

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect PostGIS extension in PostgreSQL database and enable plugin functionality when PostGIS is present. When PostGIS is not detected, system MUST log a warning and continue with schema build, exposing geometry/geography columns as generic types
- **FR-002**: System MUST register GraphQL scalar type for GeoJSON that accepts and validates GeoJSON according to RFC 7946 specification
- **FR-003**: System MUST automatically detect geometry and geography columns in database tables and expose them in GraphQL schema. For unconstrained geometry columns (allowing mixed types), system MUST detect the actual geometry type at query time and return the appropriate GraphQL type dynamically
- **FR-004**: System MUST provide GraphQL types for each PostGIS geometry subtype (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection)
- **FR-005**: System MUST support querying PostGIS columns to return spatial data in GeoJSON format
- **FR-006**: System MUST support creating records with PostGIS data via GraphQL mutations using GeoJSON input, automatically transforming coordinates to match column SRID when needed
- **FR-007**: System MUST support updating PostGIS columns via GraphQL mutations using GeoJSON input, automatically transforming coordinates to match column SRID when needed
- **FR-008**: System MUST support setting PostGIS columns to null via GraphQL mutations
- **FR-009**: System MUST expose SRID (Spatial Reference System Identifier) for all PostGIS geometry types
- **FR-010**: System MUST provide direct access to X and Y coordinates for Point geometry types
- **FR-011**: System MUST provide direct access to Z coordinate for Point geometry types when Z dimension is present
- **FR-012**: System MUST provide access to coordinate arrays for LineString and Polygon geometry types
- **FR-013**: System MUST provide access to geometries array for GeometryCollection types
- **FR-014**: System MUST provide access to rings array for Polygon types (exterior and interior boundaries)
- **FR-015**: System MUST provide access to points array for MultiPoint types
- **FR-016**: System MUST provide access to lineStrings array for MultiLineString types
- **FR-017**: System MUST provide access to polygons array for MultiPolygon types
- **FR-018**: System MUST handle geometry columns with different SRIDs correctly
- **FR-019**: System MUST handle geometry columns with Z and/or M coordinate dimensions
- **FR-020**: System MUST validate GeoJSON input in mutations and provide specific error messages that include field names, coordinate issues, and type mismatches to help developers identify and fix validation problems
- **FR-021**: System MUST handle null values in PostGIS columns gracefully in both queries and mutations
- **FR-022**: System MUST work with PostGraphile v5 plugin architecture (Graphile Config) and not require PostGraphile v4

### Key Entities *(include if feature involves data)*

- **PostGIS Geometry Column**: A database column of type `geometry` or `geography` that stores spatial data. Key attributes include geometry subtype (Point, LineString, etc.), SRID, and coordinate dimensions (XY, XYZ, XYM, XYZM).

- **GeoJSON**: A JSON format for encoding geographic data structures. Used as the input/output format for spatial data in GraphQL queries and mutations. Must conform to RFC 7946 specification.

- **GraphQL Geometry Type**: A GraphQL object type representing a specific PostGIS geometry subtype. Provides fields for accessing spatial data including GeoJSON, SRID, and type-specific fields (coordinates, rings, etc.).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can successfully query PostGIS geometry columns through GraphQL and receive valid GeoJSON responses in under 500ms for typical queries (tables with < 10,000 rows)
- **SC-002**: Developers can create new records with PostGIS data via GraphQL mutations with 100% success rate when providing valid GeoJSON input
- **SC-003**: The plugin correctly detects and exposes all PostGIS geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection) in the GraphQL schema
- **SC-004**: The plugin works with PostGraphile v5 without requiring any PostGraphile v4 dependencies or compatibility layers
- **SC-005**: Developers can access spatial metadata (SRID, coordinates) directly from GraphQL queries without parsing GeoJSON in 100% of supported geometry types
- **SC-006**: The plugin handles geometry columns with different SRIDs correctly, preserving SRID information in queries and automatically transforming coordinates to match column SRID in mutations
- **SC-007**: Invalid GeoJSON input in mutations returns specific error messages including field names, coordinate issues, and type mismatches that enable developers to identify and fix validation problems without additional debugging
- **SC-008**: The plugin gracefully handles null values in PostGIS columns without causing GraphQL query or mutation errors

## Assumptions

- PostgreSQL database may or may not have PostGIS extension installed (plugin handles both cases gracefully)
- PostGraphile v5 is being used (not v4)
- Developers are familiar with GeoJSON format (RFC 7946)
- Database tables follow standard PostGraphile naming conventions
- PostGIS geometry columns use standard PostgreSQL geometry/geography types
- The plugin will be used primarily for web-based mapping applications and geospatial APIs

## Dependencies

- PostGraphile v5 (or compatible version)
- PostgreSQL database with PostGIS extension
- Graphile Build v5 plugin system (Graphile Config)

## Out of Scope

- Support for PostGraphile v4 (this is explicitly a v5-only plugin)
- PostGIS-specific filtering operations (this may be handled by separate connection filter plugins)
- Computed spatial attributes (area, length, perimeter, centroid) - these may be added in future iterations
- Spatial indexing optimization hints
- Custom coordinate reference system definitions beyond standard SRIDs
- Support for older PostGIS versions that don't support standard functions
