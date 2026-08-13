import path from 'node:path';
import FitParser from 'fit-file-parser';
import { normalizeActivity, parseCsv, parseGpx, parseJson } from './activities.js';
import type { Activity } from './repository';

export type ImportFile = { name: string; data: string };

export async function parseFit(buffer: Buffer, source = 'igpsport'): Promise<Activity[]> {
  const parsed = await new FitParser({ mode: 'list', speedUnit: 'km/h', lengthUnit: 'km' }).parseAsync(buffer);
  const records = parsed.records || [];
  const route = records.filter(record => record.position_lat !== undefined && record.position_long !== undefined)
    .map(record => [Number(record.position_lat), Number(record.position_long), Number(record.altitude || 0)]);
  return (parsed.sessions || []).map((session, index) => normalizeActivity({
    id: session.event_group ?? index, name: session.sport === 'cycling' ? 'iGPSPORT 骑行' : '骑行记录',
    sport: session.sub_sport === 'virtual_activity' ? 'VirtualRide' : 'Ride',
    startTime: session.start_time || session.timestamp, distanceKm: session.total_distance,
    movingSeconds: session.total_moving_time || session.total_timer_time || session.total_elapsed_time,
    elevationM: session.total_ascent, avgSpeedKmh: session.avg_speed, calories: session.total_calories, route,
  }, source)) as Activity[];
}

export async function importFiles(files: ImportFile[]) {
  const imported: Activity[] = [];
  const errors: string[] = [];
  for (const file of files || []) {
    try {
      const extension = path.extname(file.name).toLowerCase();
      const buffer = Buffer.from(file.data, 'base64');
      const text = buffer.toString('utf8');
      const source = /igpsport|igs/i.test(file.name) ? 'igpsport' : 'file';
      if (extension === '.csv') imported.push(...parseCsv(text, source) as Activity[]);
      else if (extension === '.json') imported.push(...parseJson(text, source) as Activity[]);
      else if (extension === '.gpx') imported.push(...parseGpx(text, source) as Activity[]);
      else if (extension === '.fit') imported.push(...await parseFit(buffer, 'igpsport'));
      else errors.push(`${file.name}: 不支持的格式`);
    } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { imported, errors };
}
