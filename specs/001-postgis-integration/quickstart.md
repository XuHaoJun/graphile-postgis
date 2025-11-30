# Quick Start Guide: PostGIS Integration with PostGraphile v5

## Prerequisites

- PostgreSQL database with PostGIS extension installed
- PostGraphile v5 (v5.0.0-rc.1 or later)
- Node.js 18+ and npm/yarn
- Docker and Docker Compose (for running tests)

## Installation

```bash
npm install @graphile/postgis-v5
# or
yarn add @graphile/postgis-v5
```

## Database Setup

1. Enable PostGIS extension in your database:

```sql
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
```

2. Create a table with PostGIS geometry columns:

```sql
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  point_location geometry(Point, 4326),
  polygon_area geometry(Polygon, 4326)
);
```

## PostGraphile Configuration

### Using graphile.config.mjs

```javascript
import { makeV4Preset } from "postgraphile/presets/v4";
import { PostgisPreset } from "@graphile/postgis-v5";

export default {
  extends: [
    makeV4Preset({
      // Your existing PostGraphile v5 configuration
    }),
    PostgisPreset,
  ],
  pgServices: [
    // Your PostgreSQL service configuration
  ],
};
```

### Using PostGraphile Library

```javascript
import { postgraphile } from "postgraphile";
import { PostgisPreset } from "@graphile/postgis-v5";

const middleware = postgraphile(
  process.env.DATABASE_URL,
  "public",
  {
    extends: [PostgisPreset],
    // Other PostGraphile options
  }
);
```

## Basic Usage

### Querying PostGIS Data

```graphql
query {
  locations {
    nodes {
      id
      name
      pointLocation {
        geojson
        srid
        x
        y
      }
      polygonArea {
        geojson
        srid
        exterior {
          points {
            x
            y
          }
        }
      }
    }
  }
}
```

### Creating Records with PostGIS Data

```graphql
mutation {
  createLocation(
    input: {
      location: {
        name: "My Location"
        pointLocation: {
          type: "Point"
          coordinates: [-122.4194, 37.7749]
        }
      }
    }
  ) {
    location {
      id
      pointLocation {
        geojson
        srid
      }
    }
  }
}
```

### Updating PostGIS Data

```graphql
mutation {
  updateLocationById(
    input: {
      id: 1
      locationPatch: {
        pointLocation: {
          type: "Point"
          coordinates: [-122.4194, 37.7749]
        }
      }
    }
  ) {
    location {
      id
      pointLocation {
        geojson
      }
    }
  }
}
```

## Supported Geometry Types

The plugin supports all PostGIS geometry types:

- **Point**: Single coordinate point
- **LineString**: Sequence of connected points
- **Polygon**: Area bounded by rings
- **MultiPoint**: Collection of points
- **MultiLineString**: Collection of linestrings
- **MultiPolygon**: Collection of polygons
- **GeometryCollection**: Collection of mixed geometry types

## Coordinate Systems

- The plugin automatically handles SRID transformations
- GeoJSON input (RFC 7946) assumes SRID 4326 (WGS84)
- Coordinates are automatically transformed to match column SRID
- SRID information is preserved in queries

## Error Handling

### Missing PostGIS Extension

If PostGIS extension is not installed, the plugin will:
- Log a warning during schema build
- Continue with schema generation
- Expose geometry columns as generic types (without PostGIS-specific fields)

### Invalid GeoJSON

Invalid GeoJSON input in mutations will return specific error messages:

```json
{
  "errors": [{
    "message": "Invalid GeoJSON: coordinates array must have at least 2 elements for Point type",
    "extensions": {
      "field": "coordinates",
      "issue": "insufficient_coordinates"
    }
  }]
}
```

## Advanced Features

### Unconstrained Geometry Columns

For columns defined as `geometry` (without subtype constraint):

```sql
CREATE TABLE mixed_geometries (
  id SERIAL PRIMARY KEY,
  geom geometry  -- Unconstrained, can contain any geometry type
);
```

The plugin automatically detects the actual geometry type at query time for each row, returning the appropriate GraphQL type dynamically.

### Z and M Coordinates

The plugin supports 3D (Z) and measured (M) coordinates:

```graphql
query {
  locations {
    nodes {
      pointLocation {
        x
        y
        z  # Available if column has Z dimension
      }
    }
  }
}
```

### Large Geometries

The plugin handles all geometry sizes. For very large geometries (> 1MB serialized), warnings are logged to help identify potential performance issues.

## Testing

### Test Database Setup

The project includes a Docker Compose configuration for running integration tests.

1. Start the test database:
   ```bash
   docker-compose up -d db
   ```

2. Create test database:
   ```bash
   psql -h localhost -U postgres -d postgres -c "CREATE DATABASE graphile_test;"
   psql -h localhost -U postgres -d graphile_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

3. Set test database URL:
   ```bash
   export TEST_DATABASE_URL=postgres://postgres:test@localhost:5432/graphile_test
   ```

4. Run tests:
   ```bash
   npm test
   # or
   yarn test
   ```

The test script will automatically load the test schema from `__tests__/fixtures/schema.sql`.

## Troubleshooting

### PostGIS Not Detected

If you see warnings about PostGIS not being detected:

1. Verify PostGIS is installed: `SELECT PostGIS_version();`
2. Check extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'postgis';`
3. Ensure the plugin runs after PostGraphile's introspection

### Type Not Found Errors

If GraphQL types are not found:

1. Ensure the plugin is included in your PostGraphile configuration
2. Check that PostGIS extension is detected (see above)
3. Verify geometry columns use `geometry` or `geography` types

### SRID Transformation Errors

If SRID transformation fails:

1. Verify both source and target SRIDs are valid
2. Check that PostGIS has the required coordinate transformation data
3. Ensure `spatial_ref_sys` table is populated

## Next Steps

- See [API Documentation](./contracts/graphql-schema.graphql) for complete GraphQL schema
- See [Data Model](./data-model.md) for entity relationships
- See [Research](./research.md) for implementation details

