module.exports = {
  roots: ["<rootDir>/src", "<rootDir>/__tests__"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testRegex: "(/__tests__/.*\\.(test|spec))\\.[tj]sx?$",
  moduleFileExtensions: ["ts", "js", "json"],
  snapshotSerializers: ["jest-serializer-graphql-schema"],
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
};

