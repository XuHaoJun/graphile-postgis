# @graphile/postgis-v5

PostGIS support for PostGraphile v5.

## Overview

The original [`@graphile/postgis`](https://github.com/graphile/postgis) plugin was built for PostGraphile v4 and is not compatible with PostGraphile v5. This project is a complete rewrite to leverage the new architecture and features of PostGraphile v5.

**Note:** This plugin is **not compatible with PostGraphile v4**. If you are using PostGraphile v4, please refer to the [original `@graphile/postgis` plugin](https://github.com/graphile/postgis).

## Status

This project is currently under active development.

## Installation

```bash
npm install @graphile/postgis-v5
# or
yarn add @graphile/postgis-v5
# or
pnpm add @graphile/postgis-v5
```

## Prerequisites

- PostgreSQL with PostGIS extension (2.5+)
- PostGraphile v5.0.0-rc.1 or later

## Usage

### Basic Setup

```typescript
import { postgraphile } from "postgraphile";
import { postgisPlugin } from "@graphile/postgis-v5";

const app = postgraphile({
  connectionString: process.env.DATABASE_URL,
  schemas: ["public"],
  plugins: [postgisPlugin],
});
```

### Using with graphile.config.mjs

```javascript
import { makeV4Preset } from "postgraphile/presets/v4";
import { postgisPlugin } from "@graphile/postgis-v5";

export default {
  extends: [
    makeV4Preset({
      connectionString: process.env.DATABASE_URL,
      schemas: ["public"],
    }),
  ],
  plugins: [postgisPlugin],
};
```

### Example GraphQL Query

```graphql
query {
  locations {
    nodes {
      id
      name
      pointLocation {
        # GeoJSON format
        type
        coordinates
        
        # Direct coordinate access
        x
        y
        srid
      }
    }
  }
}
```

### Example GraphQL Mutation

```graphql
mutation {
  createLocation(
    input: {
      location: {
        name: "San Francisco"
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
        type
        coordinates
      }
    }
  }
}
```

## Features

- ✅ Query PostGIS geometry/geography columns via GraphQL (returns GeoJSON)
- ✅ Mutate PostGIS data using GeoJSON input format (RFC 7946)
- ✅ Support for all PostGIS geometry types:
  - Point, LineString, Polygon
  - MultiPoint, MultiLineString, MultiPolygon
  - GeometryCollection
- ✅ Direct coordinate access (x, y, z, srid fields for Point types)
- ✅ Type-specific fields (points for LineString, exterior/interiors for Polygon, etc.)
- ✅ Automatic SRID handling and transformation
- ✅ Support for XY, XYZ, XYM, and XYZM coordinate dimensions
- ✅ Comprehensive GeoJSON validation with detailed error messages
- ✅ Large geometry warnings for performance monitoring

## Troubleshooting

### PostGIS Extension Not Detected

If you see warnings about PostGIS not being detected:

1. Verify PostGIS is installed:
   ```sql
   SELECT PostGIS_version();
   ```

2. Check extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'postgis';
   ```

3. Enable PostGIS if needed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

### Invalid GeoJSON Errors

If mutations fail with GeoJSON validation errors:

- Ensure coordinates match the expected format (array of numbers)
- Check that the `type` field matches the column's geometry type constraint
- Verify coordinates are valid numbers (not strings)

### Type Not Found Errors

If GraphQL types are not found:

1. Ensure the plugin is included in your PostGraphile configuration
2. Check that PostGIS extension is detected
3. Verify geometry columns use `geometry` or `geography` types (not `geometry(Point, 4326)` syntax issues)

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT

