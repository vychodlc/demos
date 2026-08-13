import type { PoolClient } from 'pg';
import { query, transaction } from './db';

export type Activity = {
  id: string; source: string; sourceId: string | null; name: string; sport: string;
  startTime: string; date: string; distanceKm: number; movingSeconds: number;
  elevationM: number; avgSpeedKmh: number; calories: number; route: number[][];
};

type ActivityRow = {
  id: string; source: string; source_id: string | null; name: string; sport: string;
  start_time: Date; local_date: string | Date; distance_km: number; moving_seconds: number;
  elevation_m: number; avg_speed_kmh: number; calories: number; route: number[][];
};

function fromRow(row: ActivityRow): Activity {
  return {
    id: row.id, source: row.source, sourceId: row.source_id, name: row.name, sport: row.sport,
    startTime: new Date(row.start_time).toISOString(),
    date: typeof row.local_date === 'string' ? row.local_date.slice(0, 10) : row.local_date.toISOString().slice(0, 10),
    distanceKm: Number(row.distance_km), movingSeconds: row.moving_seconds, elevationM: row.elevation_m,
    avgSpeedKmh: Number(row.avg_speed_kmh), calories: row.calories, route: row.route || [],
  };
}

export async function listActivities(userId: string) {
  const result = await query<ActivityRow>('SELECT * FROM activities WHERE user_id=$1 ORDER BY start_time DESC', [userId]);
  return result.rows.map(fromRow);
}

async function upsert(client: PoolClient, userId: string, activity: Activity) {
  await client.query(
    'INSERT INTO activities (id,user_id,source,source_id,name,sport,start_time,local_date,distance_km,moving_seconds,elevation_m,avg_speed_kmh,calories,route) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (user_id,id) DO UPDATE SET source=EXCLUDED.source,source_id=EXCLUDED.source_id,name=EXCLUDED.name,sport=EXCLUDED.sport,start_time=EXCLUDED.start_time,local_date=EXCLUDED.local_date,distance_km=EXCLUDED.distance_km,moving_seconds=EXCLUDED.moving_seconds,elevation_m=EXCLUDED.elevation_m,avg_speed_kmh=EXCLUDED.avg_speed_kmh,calories=EXCLUDED.calories,route=EXCLUDED.route,updated_at=NOW()',
    [activity.id,userId,activity.source,activity.sourceId,activity.name,activity.sport,activity.startTime,activity.date,
      activity.distanceKm,activity.movingSeconds,activity.elevationM,activity.avgSpeedKmh,activity.calories,JSON.stringify(activity.route)],
  );
}

export async function saveActivities(userId: string, activities: Activity[]) {
  await transaction(async client => { for (const activity of activities) await upsert(client, userId, activity); });
}

export async function updateAnnualGoal(userId: string, annualGoal: number) {
  const goal = Math.max(100, Math.round(annualGoal));
  await query('UPDATE users SET annual_goal=$1,updated_at=NOW() WHERE id=$2', [goal, userId]);
  return goal;
}
