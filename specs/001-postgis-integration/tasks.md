# Tasks: PostGIS Integration with PostGraphile v5

**Input**: Design documents from `/specs/001-postgis-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included per Constitution requirement (TDD preferred). All test tasks should be written first and fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `__tests__/` at repository root
- Paths follow plan.md structure: `src/` for source, `__tests__/` for tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory structure (src/, __tests__/, scripts/) per plan.md
- [x] T002 [P] Initialize package.json with PostGraphile v5 dependencies (postgraphile, graphile-build, graphile-build-pg, @dataplan/pg, grafast, pg-sql2, graphql)
- [x] T003 [P] Create tsconfig.json with TypeScript strict mode enabled
- [x] T004 [P] Configure Jest with ts-jest in jest.config.js
- [x] T005 [P] Setup Prettier and ESLint configuration files
- [x] T006 [P] Create .gitignore file for Node.js/TypeScript project
- [x] T007 Create README.md with basic project description and installation instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create src/constants.ts with geometry subtype constants (GIS_SUBTYPE, GIS_SUBTYPE_NAME, SUBTYPE_STRING_BY_SUBTYPE)
- [x] T009 Create src/types.ts with TypeScript type definitions (Subtype, GISTypeDetails, etc.)
- [x] T010 Create src/utils.ts with utility functions (getGISTypeDetails, getGISTypeModifier, getGISTypeName)
- [x] T011 Create src/inflection.ts with inflection functions for naming GIS types (gisType, gisInterfaceName, geojsonFieldName, gisXFieldName, etc.)
- [x] T012 Create src/PostgisExtensionPlugin.ts with gather hook to detect PostGIS extension and geometry/geography types
- [x] T013 Create __tests__/fixtures/schema.sql with test database schema (tables with various geometry types, SRIDs, Z/M coordinates, unconstrained geometry, null columns)
- [x] T014 Create scripts/test script that checks TEST_DATABASE_URL and loads schema.sql before running tests

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Query PostGIS Data from GraphQL API (Priority: P1) 🎯 MVP

**Goal**: Enable developers to query PostGIS geometry columns through GraphQL and receive spatial data in GeoJSON format

**Independent Test**: Create a database table with a PostGIS geometry column, run PostGraphile v5 with this plugin enabled, and successfully execute a GraphQL query that retrieves the spatial data in GeoJSON format

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US1] Create unit test for PostGIS extension detection in __tests__/unit/extension.test.ts
- [ ] T016 [P] [US1] Create integration test for basic geometry query in __tests__/integration/queries.test.ts (tests Point geometry query returns GeoJSON)
- [ ] T017 [P] [US1] Create snapshot test for GraphQL schema generation in __tests__/integration/schema.test.ts

### Implementation for User Story 1

- [x] T018 [US1] Create src/validation.ts with GeoJSON validation functions (validateGeoJSON structure, coordinates, type matching)
- [x] T019 [US1] Create src/PostgisScalarPlugin.ts to register GeoJSON scalar type during init hook in src/PostgisScalarPlugin.ts
- [x] T020 [US1] Create src/codec.ts with custom PgCodec implementation for geometry/geography types (fromPg method for querying)
- [x] T021 [US1] Create src/PostgisCodecPlugin.ts to register custom codec during gather phase in src/PostgisCodecPlugin.ts
- [x] T022 [US1] Create src/PostgisTypesPlugin.ts to register base GeometryInterface and basic geometry GraphQL types (Point, LineString, Polygon) during init hook
- [x] T023 [US1] Implement codec fromPg method in src/codec.ts to generate SQL with ST_AsGeoJSON, ST_SRID, geometrytype functions
- [x] T024 [US1] Implement GraphQL type registration for geometry and geography columns in src/PostgisTypesPlugin.ts
- [x] T025 [US1] Create src/index.ts to export main plugin preset combining all sub-plugins
- [x] T026 [US1] Add error handling for null geometry values in queries in src/codec.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - developers can query PostGIS columns and receive GeoJSON

---

## Phase 4: User Story 2 - Create and Update PostGIS Data via Mutations (Priority: P2)

**Goal**: Enable developers to create and update records with PostGIS data via GraphQL mutations using GeoJSON input

**Independent Test**: Execute a GraphQL mutation to create a new record with PostGIS data provided as GeoJSON, then verify the data was correctly stored in the database

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US2] Create unit test for GeoJSON validation in __tests__/unit/validation.test.ts (test invalid GeoJSON returns specific errors)
- [ ] T028 [P] [US2] Create integration test for mutation create in __tests__/integration/mutations.test.ts (test creating record with Point geometry)
- [ ] T029 [P] [US2] Create integration test for mutation update in __tests__/integration/mutations.test.ts (test updating geometry column)
- [ ] T030 [P] [US2] Create integration test for mutation null handling in __tests__/integration/mutations.test.ts (test setting geometry to null)

### Implementation for User Story 2

- [x] T031 [US2] Implement codec toPg method in src/codec.ts to validate GeoJSON and convert to PostGIS using ST_GeomFromGeoJSON
- [x] T032 [US2] Implement SRID transformation logic in src/codec.ts (detect GeoJSON SRID, compare with column SRID, apply ST_Transform if needed)
- [x] T033 [US2] Enhance GeoJSON validation in src/validation.ts to provide specific error messages with field names, coordinate issues, and type mismatches
- [x] T034 [US2] Register GeoJSON as input type for geometry/geography columns in src/PostgisTypesPlugin.ts
- [x] T035 [US2] Add error handling for invalid GeoJSON in mutations with detailed error messages in src/codec.ts
- [ ] T036 [US2] Test SRID transformation with different source and target SRIDs in __tests__/integration/mutations.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - developers can query and mutate PostGIS data

---

## Phase 5: User Story 3 - Access Spatial Metadata and Coordinates (Priority: P2)

**Goal**: Enable developers to access spatial metadata (SRID) and coordinate values directly from GraphQL queries without parsing GeoJSON

**Independent Test**: Query a Point geometry column and verify that fields like x (longitude), y (latitude), and srid are available and return correct values

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T037 [P] [US3] Create integration test for Point x/y fields in __tests__/integration/queries.test.ts (test Point geometry returns x, y, srid fields)
- [ ] T038 [P] [US3] Create integration test for Point z field in __tests__/integration/queries.test.ts (test Point with Z coordinate returns z field)
- [ ] T039 [P] [US3] Create integration test for LineString points field in __tests__/integration/queries.test.ts (test LineString returns points array)

### Implementation for User Story 3

- [x] T040 [US3] Create src/PostgisPointFieldsPlugin.ts to add x, y, z fields to Point geometry types using GraphQLObjectType_fields hook
- [x] T041 [US3] Implement x and y field plans in src/PostgisPointFieldsPlugin.ts using ST_X and ST_Y PostGIS functions
- [x] T042 [US3] Implement z field plan in src/PostgisPointFieldsPlugin.ts using ST_Z PostGIS function (conditional on hasZ)
- [x] T043 [US3] Create src/PostgisLineStringFieldsPlugin.ts to add points array field to LineString types
- [x] T044 [US3] Implement points field plan in src/PostgisLineStringFieldsPlugin.ts to extract coordinates from GeoJSON or use ST_DumpPoints
- [x] T045 [US3] Create src/PostgisPolygonFieldsPlugin.ts to add exterior and interiors fields to Polygon types
- [x] T046 [US3] Implement exterior and interiors field plans in src/PostgisPolygonFieldsPlugin.ts to extract rings from GeoJSON
- [x] T047 [US3] Update src/index.ts to include Point, LineString, and Polygon field plugins

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently - developers can query PostGIS data with direct coordinate access

---

## Phase 6: User Story 4 - Support Multiple Geometry Types (Priority: P3)

**Goal**: Support all PostGIS geometry types (MultiPoint, MultiLineString, MultiPolygon, GeometryCollection) with appropriate type-specific fields

**Independent Test**: Create tables with different geometry types and verify each type is correctly exposed in the GraphQL schema with appropriate fields

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T048 [P] [US4] Create integration test for MultiPoint in __tests__/integration/queries.test.ts (test MultiPoint returns points array)
- [ ] T049 [P] [US4] Create integration test for MultiLineString in __tests__/integration/queries.test.ts (test MultiLineString returns lineStrings array)
- [ ] T050 [P] [US4] Create integration test for MultiPolygon in __tests__/integration/queries.test.ts (test MultiPolygon returns polygons array)
- [ ] T051 [P] [US4] Create integration test for GeometryCollection in __tests__/integration/queries.test.ts (test GeometryCollection returns geometries array)
- [ ] T052 [P] [US4] Create integration test for unconstrained geometry in __tests__/integration/queries.test.ts (test dynamic type detection per row)

### Implementation for User Story 4

- [x] T053 [US4] Register GraphQL types for MultiPoint, MultiLineString, MultiPolygon, GeometryCollection in src/PostgisTypesPlugin.ts (already handled by GeoJSON scalar mapping)
- [x] T054 [US4] Create src/PostgisMultiPointFieldsPlugin.ts to add points array field to MultiPoint types
- [x] T055 [US4] Implement points field plan in src/PostgisMultiPointFieldsPlugin.ts
- [x] T056 [US4] Create src/PostgisMultiLineStringFieldsPlugin.ts to add lineStrings array field to MultiLineString types
- [x] T057 [US4] Implement lineStrings field plan in src/PostgisMultiLineStringFieldsPlugin.ts
- [x] T058 [US4] Create src/PostgisMultiPolygonFieldsPlugin.ts to add polygons array field to MultiPolygon types
- [x] T059 [US4] Implement polygons field plan in src/PostgisMultiPolygonFieldsPlugin.ts
- [x] T060 [US4] Create src/PostgisGeometryCollectionFieldsPlugin.ts to add geometries array field to GeometryCollection types
- [x] T061 [US4] Implement geometries field plan in src/PostgisGeometryCollectionFieldsPlugin.ts
- [ ] T062 [US4] Implement dynamic type detection for unconstrained geometry columns in src/codec.ts (use geometrytype() function at query time)
- [x] T063 [US4] Update src/index.ts to include all Multi* and GeometryCollection field plugins

**Checkpoint**: All user stories should now be independently functional - full PostGIS geometry type support

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T064 [P] Add dimension-specific interfaces (XY, XYZ, XYM, XYZM) to geometry types in src/PostgisTypesPlugin.ts
- [ ] T065 [P] Implement large geometry warning logging (> 1MB serialized) in src/codec.ts
- [ ] T066 [P] Add comprehensive error handling for edge cases (missing PostGIS, invalid SRID transformations) across all plugins
- [ ] T067 [P] Update README.md with usage examples, installation instructions, and troubleshooting guide
- [ ] T068 [P] Add JSDoc comments to all public APIs and plugin entry points
- [ ] T069 [P] Create unit tests for utility functions in __tests__/unit/utils.test.ts
- [ ] T070 [P] Create unit tests for codec methods in __tests__/unit/codec.test.ts
- [ ] T071 Run quickstart.md validation - verify all examples work correctly
- [ ] T072 [P] Performance testing - verify query response time < 500ms for typical queries
- [ ] T073 [P] Code cleanup and refactoring - ensure zero linting warnings
- [ ] T074 [P] Update package.json with proper metadata, keywords, and repository information

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed sequentially in priority order (P1 → P2 → P3)
  - Or in parallel if team capacity allows (after foundational is complete)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 (needs codec and types from US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 (needs geometry types from US1)
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 (needs base types and interfaces from US1)

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Core infrastructure (codec, types) before field additions
- Base types before type-specific fields
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Stories 2, 3, and 4 can potentially start in parallel (if US1 is complete)
- All tests for a user story marked [P] can run in parallel
- Field plugins within a story marked [P] can run in parallel (different geometry types)
- Different user stories can be worked on in parallel by different team members (after dependencies are met)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create unit test for PostGIS extension detection in __tests__/unit/extension.test.ts"
Task: "Create integration test for basic geometry query in __tests__/integration/queries.test.ts"
Task: "Create snapshot test for GraphQL schema generation in __tests__/integration/schema.test.ts"

# These can run in parallel as they test different aspects
```

---

## Parallel Example: User Story 4

```bash
# Launch all field plugins for User Story 4 together (after base types exist):
Task: "Create src/PostgisMultiPointFieldsPlugin.ts to add points array field to MultiPoint types"
Task: "Create src/PostgisMultiLineStringFieldsPlugin.ts to add lineStrings array field to MultiLineString types"
Task: "Create src/PostgisMultiPolygonFieldsPlugin.ts to add polygons array field to MultiPolygon types"
Task: "Create src/PostgisGeometryCollectionFieldsPlugin.ts to add geometries array field to GeometryCollection types"

# These can run in parallel as they modify different GraphQL types
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

**MVP Deliverable**: Developers can query PostGIS geometry columns and receive GeoJSON responses

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Full CRUD)
4. Add User Story 3 → Test independently → Deploy/Demo (Enhanced queries)
5. Add User Story 4 → Test independently → Deploy/Demo (Complete geometry support)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP - blocking)
   - Developer B: Prepares User Story 2 tests (can start after US1 codec exists)
   - Developer C: Prepares User Story 3 tests (can start after US1 types exist)
3. After User Story 1 completes:
   - Developer A: User Story 2 (mutations)
   - Developer B: User Story 3 (metadata fields)
   - Developer C: User Story 4 (multi types)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Constitution requires TDD - write tests first, ensure they fail, then implement
- All tasks must follow TypeScript strict mode and zero linting warnings

