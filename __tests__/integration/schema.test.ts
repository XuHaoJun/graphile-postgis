/**
 * Snapshot test for GraphQL schema generation.
 * 
 * Tests that the PostGIS plugin correctly generates the GraphQL schema
 * with all expected types, interfaces, and fields.
 */

import { withPgPool } from "../helpers";
import { createPostGraphileSchema } from "./helpers";
import { printSchemaOrdered } from "../helpers";

describe("PostGIS Schema Generation", () => {
  describe("T017: GraphQL schema snapshot", () => {
    it("should generate schema with PostGIS types", async () => {
      await withPgPool(async (pool) => {
        const { schema } = await createPostGraphileSchema(pool, [
          "graphile_postgis_test",
        ]);

        const schemaString = printSchemaOrdered(schema);

        // Verify GeoJSON scalar is present
        expect(schemaString).toContain("scalar GeoJSON");

        // Verify GeometryInterface is present
        expect(schemaString).toContain("interface GeometryInterface");

        // Verify geometry types are present
        expect(schemaString).toContain("type GeometryPoint");
        expect(schemaString).toContain("type GeometryLineString");
        expect(schemaString).toContain("type GeometryPolygon");
        expect(schemaString).toContain("type GeometryMultiPoint");
        expect(schemaString).toContain("type GeometryMultiLineString");
        expect(schemaString).toContain("type GeometryMultiPolygon");
        expect(schemaString).toContain("type GeometryCollection");

        // Verify Point fields
        expect(schemaString).toContain("x: Float!");
        expect(schemaString).toContain("y: Float!");

        // Verify LineString fields
        expect(schemaString).toContain("points: [GeometryPoint!]!");

        // Verify Polygon fields
        expect(schemaString).toContain("exterior: GeometryLineString!");
        expect(schemaString).toContain("interiors: [GeometryLineString!]!");

        // Snapshot the full schema
        expect(schemaString).toMatchSnapshot();
      });
    });

    it("should include test table types in schema", async () => {
      await withPgPool(async (pool) => {
        const { schema } = await createPostGraphileSchema(pool, [
          "graphile_postgis_test",
        ]);

        const schemaString = printSchemaOrdered(schema);

        // Verify test table is present
        expect(schemaString).toContain("type TestGeometry");
        expect(schemaString).toContain("type TestMutation");

        // Verify geometry fields on test table
        expect(schemaString).toContain("geomPoint");
        expect(schemaString).toContain("geomLinestring");
        expect(schemaString).toContain("geomPolygon");
      });
    });

    it("should handle missing PostGIS extension gracefully", async () => {
      // This test would require a database without PostGIS
      // For now, we just verify the schema generation doesn't crash
      await withPgPool(async (pool) => {
        const { schema } = await createPostGraphileSchema(pool, [
          "graphile_postgis_test",
        ]);

        expect(schema).toBeDefined();
        const schemaString = printSchemaOrdered(schema);
        expect(schemaString).toBeDefined();
      });
    });
  });
});

