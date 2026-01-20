import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * @swagger
 * /api/v1/alerts:
 *   get:
 *     summary: List alerts
 *     description: Retrieve alerts with optional filtering by status, severity, and type
 *     tags:
 *       - Alerts
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, acknowledged, resolved, snoozed]
 *           default: open
 *         description: Filter by alert status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *         description: Filter by alert severity
 *       - in: query
 *         name: alert_type
 *         schema:
 *           type: string
 *           enum: [rule_failure, freshness_sla, volume_anomaly]
 *         description: Filter by alert type
 *       - in: query
 *         name: dataset_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by dataset ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Paginated list of alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
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
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status') || 'open';
  const severity = searchParams.get('severity');
  const alertType = searchParams.get('alert_type');
  const datasetId = searchParams.get('dataset_id');

  let query = supabase
    .from('alerts')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('severity', { ascending: true }) // critical first
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (severity) {
    query = query.eq('severity', severity);
  }

  if (alertType) {
    query = query.eq('alert_type', alertType);
  }

  if (datasetId) {
    query = query.eq('dataset_id', datasetId);
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
