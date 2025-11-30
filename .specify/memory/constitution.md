<!--
Sync Impact Report:
Version change: N/A → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Core Principles (4 principles), Development Standards, Governance
Removed sections: N/A
Templates requiring updates:
  ✅ plan-template.md - Constitution Check section aligns with principles
  ✅ spec-template.md - User Scenarios & Testing section aligns with testing standards
  ✅ tasks-template.md - Test tasks align with testing standards
Follow-up TODOs: None
-->

# Graphile PostGIS Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
All code MUST follow established patterns and maintainability standards. TypeScript strict mode MUST be enabled. Code MUST pass linting (prettier, tslint/eslint) with zero warnings. Functions MUST be focused, well-named, and documented where behavior is non-obvious. Code reviews MUST verify adherence to project style guides and architectural patterns.

**Rationale**: Consistent code quality reduces bugs, improves maintainability, and enables team collaboration. Strict typing catches errors at compile time.

### II. Testing Standards (NON-NEGOTIABLE)
All features MUST include tests before implementation (TDD preferred). Unit tests MUST cover critical paths and edge cases. Integration tests MUST validate GraphQL schema generation and PostGIS type handling. Test snapshots MUST be updated when behavior intentionally changes. Test coverage MUST be maintained for all public APIs and plugin entry points.

**Rationale**: Tests provide confidence in changes, prevent regressions, and document expected behavior. PostGIS integration requires database-level validation.

### III. User Experience Consistency
GraphQL API MUST follow PostGraphile conventions and patterns. GeoJSON format MUST comply with RFC 7946. Error messages MUST be clear and actionable. API responses MUST maintain consistent structure across all PostGIS geometry types. Breaking changes to public APIs MUST be versioned and documented.

**Rationale**: Consistency reduces cognitive load for API consumers. Following established patterns ensures compatibility with PostGraphile ecosystem.

### IV. Performance Requirements
Schema generation MUST complete within acceptable time limits for typical database sizes. GraphQL query execution MUST not introduce significant overhead beyond PostGraphile baseline. Database queries MUST be optimized to avoid N+1 problems. Memory usage MUST remain reasonable for large geometry collections.

**Rationale**: Performance directly impacts developer experience and production viability. PostGIS operations can be computationally expensive and must be handled efficiently.

## Development Standards

**Technology Stack**: TypeScript, PostGraphile v5+, PostgreSQL with PostGIS extension, Jest for testing.

**Code Style**: Prettier for formatting, tslint/eslint for linting. Follow existing codebase patterns.

**Testing**: Jest with ts-jest. Use snapshot tests for GraphQL schema validation. Integration tests require TEST_DATABASE_URL environment variable.

## Governance

This constitution supersedes all other development practices. All pull requests and code reviews MUST verify compliance with these principles. Amendments require documentation of rationale and impact assessment. Version changes follow semantic versioning: MAJOR for principle removals/redefinitions, MINOR for new principles, PATCH for clarifications.

**Version**: 1.0.0 | **Ratified**: 2025-11-30 | **Last Amended**: 2025-11-30
