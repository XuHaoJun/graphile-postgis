/**
 * Integration tests for PostGIS geometry queries.
 * 
 * Tests that PostGIS geometry columns can be queried through GraphQL
 * and return GeoJSON format.
 */

import { withPgPool } from "../helpers";
import { createPostGraphileSchema, executeGraphQLQuery } from "./helpers";

describe("PostGIS Query Integration Tests", () => {
  let schema: any;
  let resolvedPreset: any;

  beforeAll(async () => {
    await withPgPool(async (pool) => {
      const result = await createPostGraphileSchema(pool, ["graphile_postgis_test"]);
      schema = result.schema;
      resolvedPreset = result.resolvedPreset;
    });
  });

  describe("T016: Basic geometry query (Point)", () => {
    it("should query Point geometry and return GeoJSON", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomPoint {
                geojson
                srid
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data.testGeometries).toBeDefined();
      expect(result.data.testGeometries.nodes).toBeDefined();
      expect(result.data.testGeometries.nodes.length).toBeGreaterThan(0);

      const firstNode = result.data.testGeometries.nodes[0];
      expect(firstNode.geomPoint).toBeDefined();
      expect(firstNode.geomPoint.geojson).toBeDefined();
      expect(firstNode.geomPoint.geojson.type).toBe("Point");
      expect(firstNode.geomPoint.geojson.coordinates).toBeDefined();
      expect(Array.isArray(firstNode.geomPoint.geojson.coordinates)).toBe(true);
      expect(firstNode.geomPoint.srid).toBeDefined();
    });
  });

  describe("T037: Point x/y fields", () => {
    it("should return x and y fields for Point geometry", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomPoint {
                geojson
                srid
                x
                y
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomPoint) {
        expect(firstNode.geomPoint.x).toBeDefined();
        expect(firstNode.geomPoint.y).toBeDefined();
        expect(typeof firstNode.geomPoint.x).toBe("number");
        expect(typeof firstNode.geomPoint.y).toBe("number");
      }
    });
  });

  describe("T038: Point z field", () => {
    it("should return z field for Point with Z coordinate", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomPointz {
                geojson
                srid
                x
                y
                z
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomPointz) {
        expect(firstNode.geomPointz.z).toBeDefined();
        expect(typeof firstNode.geomPointz.z).toBe("number");
      }
    });
  });

  describe("T039: LineString points field", () => {
    it("should return points array for LineString geometry", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomLinestring {
                geojson
                srid
                points {
                  x
                  y
                }
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomLinestring) {
        expect(firstNode.geomLinestring.points).toBeDefined();
        expect(Array.isArray(firstNode.geomLinestring.points)).toBe(true);
        expect(firstNode.geomLinestring.points.length).toBeGreaterThan(0);
        expect(firstNode.geomLinestring.points[0].x).toBeDefined();
        expect(firstNode.geomLinestring.points[0].y).toBeDefined();
      }
    });
  });

  describe("T048: MultiPoint", () => {
    it("should return points array for MultiPoint geometry", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomMultipoint {
                geojson
                srid
                points {
                  x
                  y
                }
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomMultipoint) {
        expect(firstNode.geomMultipoint.points).toBeDefined();
        expect(Array.isArray(firstNode.geomMultipoint.points)).toBe(true);
        expect(firstNode.geomMultipoint.points.length).toBeGreaterThan(0);
      }
    });
  });

  describe("T049: MultiLineString", () => {
    it("should return lineStrings array for MultiLineString geometry", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomMultilinestring {
                geojson
                srid
                lineStrings {
                  points {
                    x
                    y
                  }
                }
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomMultilinestring) {
        expect(firstNode.geomMultilinestring.lineStrings).toBeDefined();
        expect(Array.isArray(firstNode.geomMultilinestring.lineStrings)).toBe(true);
        expect(firstNode.geomMultilinestring.lineStrings.length).toBeGreaterThan(0);
      }
    });
  });

  describe("T050: MultiPolygon", () => {
    it("should return polygons array for MultiPolygon geometry", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomMultipolygon {
                geojson
                srid
                polygons {
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
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomMultipolygon) {
        expect(firstNode.geomMultipolygon.polygons).toBeDefined();
        expect(Array.isArray(firstNode.geomMultipolygon.polygons)).toBe(true);
        expect(firstNode.geomMultipolygon.polygons.length).toBeGreaterThan(0);
      }
    });
  });

  describe("T051: GeometryCollection", () => {
    it("should return geometries array for GeometryCollection", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomGeometrycollection {
                geojson
                srid
                geometries {
                  geojson
                  srid
                }
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomGeometrycollection) {
        expect(firstNode.geomGeometrycollection.geometries).toBeDefined();
        expect(Array.isArray(firstNode.geomGeometrycollection.geometries)).toBe(true);
        expect(firstNode.geomGeometrycollection.geometries.length).toBeGreaterThan(0);
      }
    });
  });

  describe("T052: Unconstrained geometry", () => {
    it("should handle unconstrained geometry columns with dynamic type detection", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomUnconstrained {
                geojson
                srid
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const firstNode = result.data.testGeometries.nodes[0];
      if (firstNode.geomUnconstrained) {
        expect(firstNode.geomUnconstrained.geojson).toBeDefined();
        expect(firstNode.geomUnconstrained.geojson.type).toBeDefined();
      }
    });
  });

  describe("Null handling", () => {
    it("should handle null geometry values gracefully", async () => {
      const query = `
        query {
          testGeometries {
            nodes {
              id
              geomNullable {
                geojson
                srid
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, query);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      // Should not throw errors for null geometries
      const nodes = result.data.testGeometries.nodes;
      const nodeWithNull = nodes.find((n: any) => n.geomNullable === null);
      expect(nodeWithNull).toBeDefined();
    });
  });
});

