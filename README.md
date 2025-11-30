# @xuhaojun/graphile-postgis

PostGIS support for PostGraphile v5.

## Overview

The original [`@graphile/postgis`](https://github.com/graphile/postgis) plugin was built for PostGraphile v4 and is not compatible with PostGraphile v5. This project is a complete rewrite to leverage the new architecture and features of PostGraphile v5.

**Note:** This plugin is **not compatible with PostGraphile v4**. If you are using PostGraphile v4, please refer to the [original `@graphile/postgis` plugin](https://github.com/graphile/postgis).

## Status

This project is currently under active development.

## Installation

```bash
npm install @xuhaojun/graphile-postgis
# or
yarn add @xuhaojun/graphile-postgis
# or
pnpm add @xuhaojun/graphile-postgis
```

## Prerequisites

- PostgreSQL with PostGIS extension (2.5+)
- PostGraphile v5.0.0-rc or later

## Usage

### Basic Setup with graphile.config.mjs

```javascript
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makePgService } from "postgraphile/adaptors/pg";
import { postgisPlugin } from "@xuhaojun/graphile-postgis";

export default {
  extends: [PostGraphileAmberPreset, postgisPlugin],
  pgServices: [
    makePgService({
      connectionString: process.env.DATABASE_URL,
      schemas: ["public"],
    }),
  ],
};
```

### Using with makeSchema

```typescript
import * as adaptor from "postgraphile/@dataplan/pg/adaptors/pg";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makeSchema } from "postgraphile";
import { postgisPlugin } from "@xuhaojun/graphile-postgis";
import * as pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const preset = {
  extends: [PostGraphileAmberPreset, postgisPlugin],
  pgServices: [
    adaptor.makePgService({
      name: "main",
      withPgClientKey: "withPgClient",
      pgSettingsKey: "pgSettings",
      schemas: ["public"],
      pool: pool,
    }),
  ],
};

const { schema } = await makeSchema(preset);
```

### Using with V4 Compatibility (Optional)

If you're migrating from PostGraphile v4 or need v4-compatible behavior, you can add `makeV4Preset`:

```javascript
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makeV4Preset } from "postgraphile/presets/v4";
import { makePgService } from "postgraphile/adaptors/pg";
import { postgisPlugin } from "@xuhaojun/graphile-postgis";

export default {
  extends: [
    PostGraphileAmberPreset,
    postgisPlugin,
    makeV4Preset({
      simpleCollections: "both",
      // ... other v4 options
    }),
  ],
  pgServices: [
    makePgService({
      connectionString: process.env.DATABASE_URL,
      schemas: ["public"],
    }),
  ],
};
```

### Example GraphQL Query

```graphql
query {
  allTestGeometries {
    nodes {
      id
      geomPoint {
        # GeoJSON format
        geojson {
          type
          coordinates
        }
        srid

        # Direct coordinate access for Point types
        x
        y
      }
    }
  }
}
```

### Example GraphQL Query with LineString

```graphql
query {
  allTestGeometries {
    nodes {
      id
      geomLinestring {
        geojson {
          type
          coordinates
        }
        srid
        # Type-specific fields for LineString
        points {
          x
          y
        }
      }
    }
  }
}
```

### Example GraphQL Mutation (Create)

```graphql
mutation {
  createTestMutation(
    input: {
      testMutation: {
        name: "San Francisco"
        location: { type: "Point", coordinates: [-122.4194, 37.7749] }
      }
    }
  ) {
    testMutation {
      id
      name
      location {
        geojson {
          type
          coordinates
        }
        srid
        x
        y
      }
    }
  }
}
```

### Example GraphQL Mutation (Update)

```graphql
mutation {
  updateTestMutationById(
    input: {
      id: 1
      testMutationPatch: {
        location: { type: "Point", coordinates: [-122.4194, 37.7749] }
      }
    }
  ) {
    testMutation {
      id
      location {
        geojson {
          type
          coordinates
        }
        x
        y
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
- ✅ Type-specific fields:
  - `points` for LineString and MultiPoint
  - `exterior` and `interiors` for Polygon
  - `lineStrings` for MultiLineString
  - `polygons` for MultiPolygon
  - `geometries` for GeometryCollection
- ✅ Automatic SRID handling and transformation
- ✅ Support for XY, XYZ, XYM, and XYZM coordinate dimensions
- ✅ Comprehensive GeoJSON validation with detailed error messages
- ✅ Large geometry warnings for performance monitoring
- ✅ Null geometry handling

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
