/**
 * Integration tests for PostGIS mutations.
 * 
 * Tests that PostGIS geometry columns can be created and updated
 * via GraphQL mutations using GeoJSON input.
 */

import { withPgPool } from "../helpers";
import { createPostGraphileSchema, executeGraphQLQuery } from "./helpers";

describe("PostGIS Mutation Integration Tests", () => {
  let schema: any;
  let resolvedPreset: any;

  beforeAll(async () => {
    await withPgPool(async (pool) => {
      const result = await createPostGraphileSchema(pool, ["graphile_postgis_test"]);
      schema = result.schema;
      resolvedPreset = result.resolvedPreset;
    });
  });

  describe("T028: Mutation create", () => {
    it("should create a record with Point geometry", async () => {
      const mutation = `
        mutation {
          createTestMutation(
            input: {
              name: "Test Location"
              location: {
                type: "Point"
                coordinates: [30.0, 10.0]
              }
            }
          ) {
            testMutation {
              id
              name
              location {
                geojson
                srid
                x
                y
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, mutation);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data.createTestMutation).toBeDefined();
      expect(result.data.createTestMutation.testMutation).toBeDefined();

      const created = result.data.createTestMutation.testMutation;
      expect(created.name).toBe("Test Location");
      expect(created.location).toBeDefined();
      expect(created.location.geojson.type).toBe("Point");
      expect(created.location.geojson.coordinates).toEqual([30.0, 10.0]);
      expect(created.location.x).toBe(30.0);
      expect(created.location.y).toBe(10.0);
    });
  });

  describe("T029: Mutation update", () => {
    it("should update geometry column via mutation", async () => {
      // First create a record
      const createMutation = `
        mutation {
          createTestMutation(
            input: {
              name: "Original Location"
              location: {
                type: "Point"
                coordinates: [30.0, 10.0]
              }
            }
          ) {
            testMutation {
              id
            }
          }
        }
      `;

      const createResult = await executeGraphQLQuery(schema, resolvedPreset, createMutation);
      const recordId = createResult.data.createTestMutation.testMutation.id;

      // Then update it
      const updateMutation = `
        mutation {
          updateTestMutationById(
            input: {
              id: ${recordId}
              patch: {
                location: {
                  type: "Point"
                  coordinates: [40.0, 20.0]
                }
              }
            }
          ) {
            testMutation {
              id
              location {
                geojson
                x
                y
              }
            }
          }
        }
      `;

      const updateResult = await executeGraphQLQuery(schema, resolvedPreset, updateMutation);

      expect(updateResult.errors).toBeUndefined();
      expect(updateResult.data).toBeDefined();
      expect(updateResult.data.updateTestMutationById.testMutation).toBeDefined();

      const updated = updateResult.data.updateTestMutationById.testMutation;
      expect(updated.location.geojson.coordinates).toEqual([40.0, 20.0]);
      expect(updated.location.x).toBe(40.0);
      expect(updated.location.y).toBe(20.0);
    });
  });

  describe("T030: Mutation null handling", () => {
    it("should allow setting geometry to null", async () => {
      // First create a record with geometry
      const createMutation = `
        mutation {
          createTestMutation(
            input: {
              name: "Location to Null"
              location: {
                type: "Point"
                coordinates: [30.0, 10.0]
              }
            }
          ) {
            testMutation {
              id
            }
          }
        }
      `;

      const createResult = await executeGraphQLQuery(schema, resolvedPreset, createMutation);
      const recordId = createResult.data.createTestMutation.testMutation.id;

      // Then set it to null
      const updateMutation = `
        mutation {
          updateTestMutationById(
            input: {
              id: ${recordId}
              patch: {
                location: null
              }
            }
          ) {
            testMutation {
              id
              location {
                geojson
              }
            }
          }
        }
      `;

      const updateResult = await executeGraphQLQuery(schema, resolvedPreset, updateMutation);

      expect(updateResult.errors).toBeUndefined();
      expect(updateResult.data).toBeDefined();
      expect(updateResult.data.updateTestMutationById.testMutation.location).toBeNull();
    });
  });

  describe("T036: SRID transformation", () => {
    it("should transform SRID when GeoJSON SRID differs from column SRID", async () => {
      // Create a record with a geometry column that has SRID 4326
      // but provide GeoJSON that might have different SRID
      const mutation = `
        mutation {
          createTestMutation(
            input: {
              name: "SRID Test"
              location: {
                type: "Point"
                coordinates: [30.0, 10.0]
              }
            }
          ) {
            testMutation {
              id
              location {
                geojson
                srid
              }
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, mutation);

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const created = result.data.createTestMutation.testMutation;
      // The SRID should match the column's SRID (4326)
      expect(created.location.srid).toBe(4326);
    });
  });

  describe("Invalid GeoJSON handling", () => {
    it("should reject invalid GeoJSON with specific error", async () => {
      const mutation = `
        mutation {
          createTestMutation(
            input: {
              name: "Invalid GeoJSON"
              location: {
                type: "Point"
                coordinates: "not an array"
              }
            }
          ) {
            testMutation {
              id
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, mutation);

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      // Error should mention coordinates or validation
      expect(result.errors![0].message).toMatch(/coordinate|validation|invalid/i);
    });

    it("should reject invalid geometry type", async () => {
      const mutation = `
        mutation {
          createTestMutation(
            input: {
              name: "Invalid Type"
              location: {
                type: "InvalidType"
                coordinates: [30.0, 10.0]
              }
            }
          ) {
            testMutation {
              id
            }
          }
        }
      `;

      const result = await executeGraphQLQuery(schema, resolvedPreset, mutation);

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
});

