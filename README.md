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

```typescript
import { postgraphile } from "postgraphile";
import { postgisPlugin } from "@graphile/postgis-v5";

const app = postgraphile({
  database: "my_database",
  schemas: ["public"],
  plugins: [postgisPlugin],
});
```

## Features

- Query PostGIS geometry/geography columns via GraphQL
- Mutate PostGIS data using GeoJSON input format
- Support for all PostGIS geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection)
- Automatic SRID transformation for mutations
- Support for XY, XYZ, XYM, and XYZM coordinate dimensions
- Dynamic type detection for unconstrained geometry columns

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

