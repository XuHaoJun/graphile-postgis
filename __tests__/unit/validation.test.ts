/**
 * Unit tests for GeoJSON validation functions.
 * 
 * Tests the validation functions in src/validation.ts to ensure
 * GeoJSON input is properly validated according to RFC 7946.
 */

import {
  validateGeoJSON,
  validateGeoJSONStructure,
  validateCoordinates,
} from "../../src/validation";

describe("GeoJSON Validation", () => {
  describe("validateGeoJSONStructure", () => {
    it("should accept null values", () => {
      const errors = validateGeoJSONStructure(null);
      expect(errors).toEqual([]);
    });

    it("should reject non-object values", () => {
      const errors = validateGeoJSONStructure("not an object");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("root");
      expect(errors[0].message).toContain("object");
    });

    it("should reject arrays", () => {
      const errors = validateGeoJSONStructure([1, 2, 3]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("root");
    });

    it("should require type property", () => {
      const errors = validateGeoJSONStructure({ coordinates: [1, 2] });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("type");
      expect(errors[0].message).toContain("type");
    });

    it("should accept valid Point geometry", () => {
      const geojson = {
        type: "Point",
        coordinates: [100.0, 0.0],
      };
      const errors = validateGeoJSONStructure(geojson);
      expect(errors).toEqual([]);
    });

    it("should accept valid LineString geometry", () => {
      const geojson = {
        type: "LineString",
        coordinates: [
          [100.0, 0.0],
          [101.0, 1.0],
        ],
      };
      const errors = validateGeoJSONStructure(geojson);
      expect(errors).toEqual([]);
    });

    it("should accept valid Polygon geometry", () => {
      const geojson = {
        type: "Polygon",
        coordinates: [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
          ],
        ],
      };
      const errors = validateGeoJSONStructure(geojson);
      expect(errors).toEqual([]);
    });
  });

  describe("validateCoordinates", () => {
    it("should validate Point coordinates", () => {
      const errors = validateCoordinates([100.0, 0.0]);
      expect(errors).toEqual([]);
    });

    it("should reject empty coordinates array", () => {
      const errors = validateCoordinates([]);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should accept Point with Z coordinate", () => {
      const errors = validateCoordinates([100.0, 0.0, 50.0]);
      expect(errors).toEqual([]);
    });

    it("should validate LineString coordinates", () => {
      const errors = validateCoordinates([
        [100.0, 0.0],
        [101.0, 1.0],
      ]);
      expect(errors).toEqual([]);
    });

    it("should validate Polygon coordinates", () => {
      const errors = validateCoordinates([
        [
          [100.0, 0.0],
          [101.0, 0.0],
          [101.0, 1.0],
          [100.0, 1.0],
          [100.0, 0.0],
        ],
      ]);
      expect(errors).toEqual([]);
    });

    it("should reject non-numeric coordinates", () => {
      const errors = validateCoordinates(["100", "0"]);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should reject non-array coordinates", () => {
      const errors = validateCoordinates("not an array");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateGeoJSON", () => {
    it("should validate complete Point GeoJSON", () => {
      const geojson = {
        type: "Point",
        coordinates: [100.0, 0.0],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate complete LineString GeoJSON", () => {
      const geojson = {
        type: "LineString",
        coordinates: [
          [100.0, 0.0],
          [101.0, 1.0],
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate complete Polygon GeoJSON", () => {
      const geojson = {
        type: "Polygon",
        coordinates: [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0],
          ],
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate MultiPoint GeoJSON", () => {
      const geojson = {
        type: "MultiPoint",
        coordinates: [
          [100.0, 0.0],
          [101.0, 1.0],
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate MultiLineString GeoJSON", () => {
      const geojson = {
        type: "MultiLineString",
        coordinates: [
          [
            [100.0, 0.0],
            [101.0, 1.0],
          ],
          [
            [102.0, 2.0],
            [103.0, 3.0],
          ],
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate MultiPolygon GeoJSON", () => {
      const geojson = {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [102.0, 2.0],
              [103.0, 2.0],
              [103.0, 3.0],
              [102.0, 3.0],
              [102.0, 2.0],
            ],
          ],
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should validate GeometryCollection GeoJSON", () => {
      const geojson = {
        type: "GeometryCollection",
        geometries: [
          {
            type: "Point",
            coordinates: [100.0, 0.0],
          },
          {
            type: "LineString",
            coordinates: [
              [101.0, 0.0],
              [102.0, 1.0],
            ],
          },
        ],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors).toEqual([]);
    });

    it("should reject invalid geometry type", () => {
      const geojson = {
        type: "InvalidType",
        coordinates: [100.0, 0.0],
      };
      const errors = validateGeoJSON(geojson);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should reject Point with invalid coordinates", () => {
      const geojson = {
        type: "Point",
        coordinates: "not an array",
      };
      const errors = validateGeoJSON(geojson);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should provide specific error messages", () => {
      const geojson = {
        type: "Point",
        coordinates: [100.0], // Missing Y coordinate
      };
      const errors = validateGeoJSON(geojson);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBeDefined();
      expect(errors[0].message).toBeDefined();
    });
  });
});

