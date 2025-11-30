-- Test database schema for PostGIS integration tests
-- This schema includes various geometry and geography types with different constraints

drop schema if exists graphile_postgis_test cascade;
create schema graphile_postgis_test;

-- Ensure PostGIS extension is available
create extension if not exists postgis with schema public;

-- Basic test table with various geometry types
create table graphile_postgis_test.test_geometries (
  id serial primary key,
  
  -- Unconstrained geometry (can be any type)
  geom_unconstrained geometry,
  
  -- XY geometries
  geom_point geometry(point),
  geom_linestring geometry(linestring),
  geom_polygon geometry(polygon),
  geom_multipoint geometry(multipoint),
  geom_multilinestring geometry(multilinestring),
  geom_multipolygon geometry(multipolygon),
  geom_geometrycollection geometry(geometrycollection),
  
  -- XYZ geometries
  geom_pointz geometry(pointz),
  geom_linestringz geometry(linestringz),
  geom_polygonz geometry(polygonz),
  
  -- XYM geometries
  geom_pointm geometry(pointm),
  geom_linestringm geometry(linestringm),
  
  -- XYZM geometries
  geom_pointzm geometry(pointzm),
  
  -- With SRID constraints
  geom_point_4326 geometry(point, 4326),
  geom_point_27700 geometry(point, 27700),
  
  -- Nullable columns
  geom_nullable geometry(point),
  
  -- Geography types
  geog_point geography(point),
  geog_linestring geography(linestring),
  geog_polygon geography(polygon)
);

-- Insert test data
insert into graphile_postgis_test.test_geometries (
  geom_unconstrained,
  geom_point,
  geom_linestring,
  geom_polygon,
  geom_multipoint,
  geom_multilinestring,
  geom_multipolygon,
  geom_geometrycollection,
  geom_pointz,
  geom_linestringz,
  geom_polygonz,
  geom_pointm,
  geom_linestringm,
  geom_pointzm,
  geom_point_4326,
  geom_point_27700,
  geom_nullable,
  geog_point,
  geog_linestring,
  geog_polygon
) values (
  ST_GeometryFromText('POINT (30 10)'),
  ST_GeometryFromText('POINT (30 10)'),
  ST_GeometryFromText('LINESTRING (30 10, 10 30, 40 40)'),
  ST_GeometryFromText('POLYGON ((35 10, 45 45, 15 40, 10 20, 35 10), (20 30, 35 35, 30 20, 20 30))'),
  ST_GeometryFromText('MULTIPOINT (10 40, 40 30, 20 20, 30 10)'),
  ST_GeometryFromText('MULTILINESTRING ((10 10, 20 20, 10 40), (40 40, 30 30, 40 20, 30 10))'),
  ST_GeometryFromText('MULTIPOLYGON (((40 40, 20 45, 45 30, 40 40)), ((20 35, 10 30, 10 10, 30 5, 45 20, 20 35), (30 20, 20 15, 20 25, 30 20)))'),
  ST_GeometryFromText('GEOMETRYCOLLECTION(POINT(4 6),LINESTRING(4 6,7 10))'),
  ST_GeometryFromText('POINT Z (30 10 80)'),
  ST_GeometryFromText('LINESTRING Z (30 10 80, 10 30 80, 40 40 80)'),
  ST_GeometryFromText('POLYGON Z ((35 10 80, 45 45 80, 15 40 80, 10 20 80, 35 10 80))'),
  ST_GeometryFromText('POINT M (30 10 99)'),
  ST_GeometryFromText('LINESTRING M (30 10 99, 10 30 99, 40 40 99)'),
  ST_GeometryFromText('POINT ZM (30 10 80 99)'),
  ST_GeometryFromText('SRID=4326;POINT (30 10)'),
  ST_GeometryFromText('SRID=27700;POINT (437300 115500)'),
  NULL,
  ST_GeographyFromText('POINT (30 10)'),
  ST_GeographyFromText('LINESTRING (30 10, 10 30, 40 40)'),
  ST_GeographyFromText('POLYGON ((35 10, 45 45, 15 40, 10 20, 35 10))')
);

-- Table for testing mutations
create table graphile_postgis_test.test_mutations (
  id serial primary key,
  name text,
  location geometry(point, 4326),
  area geometry(polygon)
);

