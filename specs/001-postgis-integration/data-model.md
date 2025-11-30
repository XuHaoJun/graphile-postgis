# Data Model: PostGIS Integration

## Entities

### PostGIS Geometry Column
A database column storing spatial data.

**Attributes**:
- `type`: `geometry` or `geography`
- `subtype`: Geometry subtype (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection, or unconstrained)
- `srid`: Spatial Reference System Identifier (integer, 0 if unset)
- `hasZ`: Boolean indicating Z coordinate dimension
- `hasM`: Boolean indicating M coordinate dimension
- `namespaceName`: PostgreSQL schema name (typically "public" or PostGIS extension schema)

**Relationships**:
- Belongs to a PostgreSQL table/view
- Uses PostGIS extension types

**Validation Rules**:
- Must be of type `geometry` or `geography` in PostgreSQL
- Subtype must be one of: 0 (Geometry), 1 (Point), 2 (LineString), 3 (Polygon), 4 (MultiPoint), 5 (MultiLineString), 6 (MultiPolygon), 7 (GeometryCollection)
- SRID must be valid integer (0-999999)
- Coordinate dimensions: XY (base), XYZ (hasZ), XYM (hasM), XYZM (hasZ and hasM)

### GeoJSON
JSON format for encoding geographic data structures (RFC 7946).

**Attributes**:
- `type`: String - one of "Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection", "Feature", "FeatureCollection"
- `coordinates`: Array - coordinates array (structure varies by type)
- `geometry`: Object - (for Feature) GeoJSON geometry object
- `properties`: Object - (for Feature) feature properties
- `features`: Array - (for FeatureCollection) array of Feature objects
- `geometries`: Array - (for GeometryCollection) array of geometry objects

**Validation Rules**:
- Must conform to RFC 7946 specification
- Coordinates must be valid numbers
- Coordinate arrays must match geometry type structure
- Point: `[x, y]` or `[x, y, z]`
- LineString: `[[x1, y1], [x2, y2], ...]`
- Polygon: `[[exterior ring], [interior ring 1], ...]`
- MultiPoint: `[[x1, y1], [x2, y2], ...]`
- MultiLineString: `[[[x1, y1], [x2, y2]], ...]`
- MultiPolygon: `[[[[exterior]], [[interior]]], ...]`
- GeometryCollection: `{geometries: [...]}`

**State Transitions**: N/A (immutable data structure)

### GraphQL Geometry Type
GraphQL object type representing a PostGIS geometry subtype.

**Attributes**:
- `name`: String - GraphQL type name (e.g., "GeometryPoint", "GeometryLineString")
- `geojson`: GeoJSON scalar - GeoJSON representation
- `srid`: Int! - Spatial Reference System Identifier
- Type-specific fields (varies by subtype):
  - Point: `x`, `y`, `z` (optional)
  - LineString: `points` (array of Point)
  - Polygon: `exterior` (LineString), `interiors` (array of LineString)
  - MultiPoint: `points` (array of Point)
  - MultiLineString: `lineStrings` (array of LineString)
  - MultiPolygon: `polygons` (array of Polygon)
  - GeometryCollection: `geometries` (array of geometry types)

**Relationships**:
- Implements GraphQL interface (base geometry interface)
- May implement dimension-specific interface (XY, XYZ, XYM, XYZM)
- Used as field type on table types

**Validation Rules**:
- Type name must be unique in GraphQL schema
- Must implement base geometry interface
- Type-specific fields must match geometry subtype

### PostGIS Extension
PostgreSQL extension providing spatial data types and functions.

**Attributes**:
- `name`: String - "postgis"
- `namespaceId`: Integer - PostgreSQL namespace (schema) ID
- `namespaceName`: String - Schema name (typically "public" or custom)
- `version`: String - PostGIS version (optional, for future use)

**Relationships**:
- Provides `geometry` and `geography` types
- Provides spatial functions (ST_AsGeoJSON, ST_Transform, etc.)

**State Transitions**: N/A (extension state)

## Data Flow

### Query Flow
1. GraphQL query requests geometry field
2. PostGraphile generates SQL with PostGIS functions:
   - `ST_AsGeoJSON(geometry)` → GeoJSON text
   - `ST_SRID(geometry)` → SRID integer
   - `geometrytype(geometry)` → geometry type name
   - `ST_CoordDim(geometry)` → coordinate dimensions
3. PostgreSQL returns JSON object with `__geojson`, `__srid`, `__gisType`
4. Codec `fromPg` converts to JavaScript object
5. GraphQL resolver returns GeoJSON scalar and type-specific fields

### Mutation Flow
1. GraphQL mutation provides GeoJSON input
2. Codec `toPg` validates GeoJSON structure
3. Codec `toPg` transforms SRID if needed using `ST_Transform`
4. Codec `toPg` converts GeoJSON to PostGIS using `ST_GeomFromGeoJSON`
5. SQL generated with transformed geometry
6. PostgreSQL stores geometry in column

## Constraints

### Database Constraints
- PostGIS extension must be installed (plugin handles missing gracefully)
- Geometry columns must use `geometry` or `geography` types
- SRID must be valid for coordinate transformation

### GraphQL Schema Constraints
- GeoJSON scalar must be registered before geometry types
- Geometry types must be registered during `init` hook
- Type names must follow inflection rules
- Fields must be added via hooks (not direct modification)

### Validation Constraints
- GeoJSON must conform to RFC 7946
- Coordinates must be valid numbers
- Coordinate arrays must match geometry type
- SRID transformation must use valid SRIDs

## Relationships

```
PostGIS Extension
  ├── provides geometry type
  ├── provides geography type
  └── provides spatial functions

PostgreSQL Table
  └── has PostGIS Geometry Column
        ├── uses geometry/geography type
        └── exposed as GraphQL field

GraphQL Schema
  ├── GeoJSON Scalar Type
  ├── Geometry Interface
  └── Geometry Object Types (Point, LineString, etc.)
        └── used by table field types
```

## State Management

### Plugin State (Build-time)
- PostGIS extension detection result
- Geometry/geography type IDs
- Registered GraphQL types cache
- Codec instances

### Runtime State
- Per-query geometry type detection (for unconstrained columns)
- SRID transformation cache (optional optimization)
- Large geometry warning flags

## Edge Cases

### Missing PostGIS Extension
- Plugin logs warning
- Continues with schema build
- Geometry columns exposed as generic types

### Unconstrained Geometry Columns
- Type detected at query time per row
- Different rows may return different GraphQL types
- Uses `geometrytype()` function in SQL

### SRID Mismatch in Mutations
- Automatic transformation using `ST_Transform`
- GeoJSON assumed SRID 4326 (per RFC 7946)
- Transformed to column SRID before storage

### Invalid GeoJSON
- Validation in codec `toPg` method
- Specific error messages with field names
- GraphQL error returned to client

### Null Values
- Handled gracefully in queries (returns null)
- Handled in mutations (sets column to null)
- No errors thrown for null geometry values

### Large Geometries
- All sizes handled without rejection
- Warnings logged for geometries > 1MB serialized
- Performance may degrade for very large geometries

