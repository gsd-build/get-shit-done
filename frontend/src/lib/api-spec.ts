import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api/v1',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Data Foundations API',
        version: '1.0.0',
        description: 'REST API for data quality metadata and alerts',
      },
      servers: [{ url: '/api/v1', description: 'API v1' }],
      components: {
        schemas: {
          Dataset: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              source_id: { type: 'string', format: 'uuid' },
              database_name: { type: 'string' },
              table_name: { type: 'string' },
              schema_info: { type: 'object', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          QualityScore: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dataset_id: { type: 'string', format: 'uuid' },
              dimension: {
                type: 'string',
                enum: ['completeness', 'validity', 'uniqueness', 'consistency', 'freshness'],
              },
              score: { type: 'number', minimum: 0, maximum: 1 },
              run_id: { type: 'string', format: 'uuid', nullable: true },
              measured_at: { type: 'string', format: 'date-time' },
            },
          },
          Alert: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dataset_id: { type: 'string', format: 'uuid', nullable: true },
              alert_type: {
                type: 'string',
                enum: ['rule_failure', 'freshness_sla', 'volume_anomaly'],
              },
              severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
              status: {
                type: 'string',
                enum: ['open', 'acknowledged', 'resolved', 'snoozed'],
              },
              title: { type: 'string' },
              message: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          PaginatedResponse: {
            type: 'object',
            properties: {
              data: { type: 'array', items: {} },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
  });
  return spec;
};
