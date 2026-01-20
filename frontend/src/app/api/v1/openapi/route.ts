import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/api-spec';

/**
 * @swagger
 * /api/v1/openapi:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI 3.0 specification for this API
 *     tags:
 *       - Documentation
 *     responses:
 *       200:
 *         description: OpenAPI specification JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  const spec = await getApiDocs();
  return NextResponse.json(spec);
}
