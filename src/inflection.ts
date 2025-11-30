import type { GraphileConfig } from "graphile-config";
import type { PgCodec } from "@dataplan/pg";
import { SUBTYPE_STRING_BY_SUBTYPE } from "./constants";
import type { Subtype } from "./types";

declare global {
  namespace GraphileBuild {
    interface Inflection {
      gisType(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>,
        subtype: Subtype,
        hasZ: boolean,
        hasM: boolean
      ): string;
      gisInterfaceName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisDimensionInterfaceName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>,
        hasZ: boolean,
        hasM: boolean
      ): string;
      geojsonFieldName(this: Inflection): string;
      gisXFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisYFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
      gisZFieldName(
        this: Inflection,
        codec: PgCodec<any, any, any, any, any, any, any>
      ): string;
    }
  }
}

export const PostgisInflectionPlugin: GraphileConfig.Plugin = {
  name: "PostgisInflectionPlugin",
  version: "0.1.0",

  inflection: {
    add: {
      gisType(preset, codec, subtype, hasZ, hasM) {
        return this.upperCamelCase(
          [
            codec.name,
            SUBTYPE_STRING_BY_SUBTYPE[subtype],
            hasZ ? "z" : null,
            hasM ? "m" : null,
          ]
            .filter((x) => x !== null)
            .join("-")
        );
      },
      gisInterfaceName(preset, codec) {
        return this.upperCamelCase(`${codec.name}-interface`);
      },
      gisDimensionInterfaceName(preset, codec, hasZ, hasM) {
        return this.upperCamelCase(
          [
            codec.name,
            SUBTYPE_STRING_BY_SUBTYPE[0],
            hasZ ? "z" : null,
            hasM ? "m" : null,
          ]
            .filter((x) => x !== null)
            .join("-")
        );
      },
      geojsonFieldName() {
        return `geojson`;
      },
      gisXFieldName(preset, codec) {
        return codec.name === "geography" ? "longitude" : "x";
      },
      gisYFieldName(preset, codec) {
        return codec.name === "geography" ? "latitude" : "y";
      },
      gisZFieldName(preset, codec) {
        return codec.name === "geography" ? "height" : "z";
      },
    },
  },
};

