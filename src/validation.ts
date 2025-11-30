/**
 * GeoJSON validation functions.
 * 
 * Validates GeoJSON structure according to RFC 7946 specification.
 * Provides detailed error messages for invalid GeoJSON input.
 */

/**
 * Represents a GeoJSON validation error with field-level details.
 */
export interface GeoJSONValidationError {
  /** The field name where the error occurred */
  field: string;
  /** Human-readable error message */
  message: string;
  /** The invalid value that caused the error (optional) */
  value?: any;
}

/**
 * Validates the basic structure of a GeoJSON object.
 * 
 * Checks that the value is an object with a valid `type` property.
 * Does not validate coordinates or geometry-specific constraints.
 * 
 * @param value - The value to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateGeoJSONStructure(
  value: any
): GeoJSONValidationError[] {
  const errors: GeoJSONValidationError[] = [];

  if (value === null || value === undefined) {
    return errors; // Null is allowed
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push({
      field: "root",
      message: "GeoJSON must be an object",
      value,
    });
    return errors;
  }

  if (!value.type) {
    errors.push({
      field: "type",
      message: "GeoJSON must have a 'type' property",
      value,
    });
    return errors; // Can't validate further without type
  }

  const validTypes = [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
    "Feature",
    "FeatureCollection",
  ];

  if (!validTypes.includes(value.type)) {
    errors.push({
      field: "type",
      message: `Invalid GeoJSON type: ${value.type}. Must be one of: ${validTypes.join(", ")}`,
      value: value.type,
    });
  }

  return errors;
}

/**
 * Validates GeoJSON coordinates structure.
 * 
 * Ensures coordinates are arrays of numbers with proper nesting depth
 * based on the geometry type.
 * 
 * @param coordinates - The coordinates array to validate
 * @param _expectedDimensions - Expected number of dimensions (2, 3, or 4) - currently unused
 * @returns Array of validation errors (empty if valid)
 */
export function validateCoordinates(
  coordinates: any,
  _expectedDimensions: number = 2
): GeoJSONValidationError[] {
  const errors: GeoJSONValidationError[] = [];

  if (!Array.isArray(coordinates)) {
    errors.push({
      field: "coordinates",
      message: "Coordinates must be an array",
      value: coordinates,
    });
    return errors;
  }

  // Validate coordinate structure based on geometry type
  // This is a simplified validation - full validation would check nesting depth
  // and coordinate values (numbers)
  if (coordinates.length === 0) {
    errors.push({
      field: "coordinates",
      message: "Coordinates array cannot be empty",
      value: coordinates,
    });
  }

  // Check that all coordinates are numbers
  const validateCoordinateNumbers = (coords: any[], path: string = ""): void => {
    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      if (Array.isArray(coord)) {
        validateCoordinateNumbers(coord, `${path}[${i}]`);
      } else if (typeof coord !== "number") {
        errors.push({
          field: `coordinates${path}[${i}]`,
          message: "Coordinate values must be numbers",
          value: coord,
        });
      }
    }
  };

  validateCoordinateNumbers(coordinates);

  return errors;
}

/**
 * Validates a complete GeoJSON object.
 * 
 * Performs structure validation, coordinate validation, and optional type checking.
 * 
 * @param value - The GeoJSON object to validate
 * @param expectedType - Optional expected geometry type (e.g., "Point", "LineString")
 * @returns Array of validation errors (empty if valid)
 * 
 * @example
 * ```ts
 * const errors = validateGeoJSON({ type: "Point", coordinates: [1, 2] }, "Point");
 * if (errors.length > 0) {
 *   console.error("Invalid GeoJSON:", errors);
 * }
 * ```
 */
export function validateGeoJSON(
  value: any,
  expectedType?: string
): GeoJSONValidationError[] {
  const errors = validateGeoJSONStructure(value);

  if (errors.length > 0) {
    return errors;
  }

  if (expectedType && value.type !== expectedType) {
    errors.push({
      field: "type",
      message: `Expected GeoJSON type '${expectedType}', but got '${value.type}'. ` +
        `Please provide GeoJSON with type '${expectedType}'.`,
      value: value.type,
    });
  }

  // Validate coordinates for geometry types (not Feature/FeatureCollection)
  if (
    value.coordinates !== undefined &&
    !["Feature", "FeatureCollection"].includes(value.type)
  ) {
    const coordErrors = validateCoordinates(value.coordinates);
    errors.push(...coordErrors);
  }

  // Validate coordinate structure based on geometry type
  if (value.coordinates !== undefined && errors.length === 0) {
    const type = value.type;
    const coords = value.coordinates;

    // Validate nesting depth based on type
    if (type === "Point") {
      if (!Array.isArray(coords) || coords.length < 2) {
        errors.push({
          field: "coordinates",
          message: "Point coordinates must be an array with at least 2 numbers [longitude, latitude]",
          value: coords,
        });
      } else if (coords.some((c: any) => typeof c !== "number")) {
        errors.push({
          field: "coordinates",
          message: "Point coordinates must contain only numbers",
          value: coords,
        });
      }
    } else if (type === "LineString") {
      if (!Array.isArray(coords) || coords.length < 2) {
        errors.push({
          field: "coordinates",
          message: "LineString coordinates must be an array with at least 2 coordinate pairs",
          value: coords,
        });
      } else if (!coords.every((c: any) => Array.isArray(c) && c.length >= 2)) {
        errors.push({
          field: "coordinates",
          message: "LineString coordinates must be an array of coordinate pairs [longitude, latitude]",
          value: coords,
        });
      }
    } else if (type === "Polygon") {
      if (!Array.isArray(coords) || coords.length < 1) {
        errors.push({
          field: "coordinates",
          message: "Polygon coordinates must be an array with at least one ring",
          value: coords,
        });
      } else if (!coords.every((ring: any) => Array.isArray(ring) && ring.length >= 4)) {
        errors.push({
          field: "coordinates",
          message: "Polygon coordinates must be an array of rings, each with at least 4 coordinate pairs",
          value: coords,
        });
      }
    }
  }

  return errors;
}

