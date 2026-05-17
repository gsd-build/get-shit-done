'use strict';

/**
 * Schema Detect Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/query/schema-detect.ts and
 * lives in schema-detect.generated.cjs. This file is a thin re-export so
 * that existing call sites (verify.cjs and tests) can continue to
 * require('./schema-detect') unchanged.
 *
 * Exports (from generated file):
 *   - SCHEMA_PATTERNS — ORM file pattern list
 *   - ORM_INFO — ORM push commands and evidence patterns
 *   - detectSchemaFiles(files) — detect schema-relevant files
 *   - detectSchemaOrm(ormName) — get ORM-specific push command info
 *   - checkSchemaDrift(changedFiles, executionLog, options) — check for drift
 *
 * Regenerate: cd sdk && npm run gen:schema-detect
 */

module.exports = require('./schema-detect.generated.cjs');
