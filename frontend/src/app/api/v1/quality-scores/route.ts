import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * @swagger
 * /api/v1/quality-scores:
 *   get:
 *     summary: List quality scores
 *     description: Retrieve quality dimension scores with optional filtering
 *     tags:
 *       - Quality Scores
 *     parameters:
 *       - in: query
 *         name: dataset_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by dataset ID
 *       - in: query
 *         name: dimension
 *         schema:
 *           type: string
 *           enum: [completeness, validity, uniqueness, consistency, freshness]
 *         description: Filter by quality dimension
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter scores measured after this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter scores measured before this date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Paginated list of quality scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QualityScore'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const datasetId = searchParams.get('dataset_id');
  const dimension = searchParams.get('dimension');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  let query = supabase
    .from('quality_scores')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('measured_at', { ascending: false });

  if (datasetId) {
    query = query.eq('dataset_id', datasetId);
  }

  if (dimension) {
    query = query.eq('dimension', dimension);
  }

  if (startDate) {
    query = query.gte('measured_at', startDate);
  }

  if (endDate) {
    query = query.lte('measured_at', endDate);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count,
    limit,
    offset,
  });
}
