import { createHash } from 'node:crypto';

const RIDE_TYPES = new Set(['ride', 'virtualride', 'mountainbikeride', 'gravelride', 'ebikeride', 'velomobile']);

function number(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function first(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
    const found = Object.keys(row).find(candidate => candidate.toLowerCase() === key.toLowerCase());
    if (found) return row[found];
  }
  return undefined;
}

function parseDuration(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parts = String(value).split(':').map(Number);
  if (parts.every(Number.isFinite)) {
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return number(value);
}

function dateKey(value) {
  const raw = String(value || '').trim();
  const date = new Date(raw);
  if (!Number.isNaN(date.valueOf())) {
    const localLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return localLike ? localLike[1] : date.toISOString().slice(0, 10);
  }
  const match = raw.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!match) return new Date().toISOString().slice(0, 10);
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function stableId(source, sourceId, startTime, distanceKm) {
  return createHash('sha1').update(`${source}:${sourceId || ''}:${startTime}:${distanceKm}`).digest('hex').slice(0, 16);
}

export function simplifyRoute(points, maxPoints = 500) {
  const clean = (points || []).map(point => {
    const values = Array.isArray(point)
      ? [number(point[0]), number(point[1]), point[2] === undefined ? undefined : number(point[2])]
      : [number(point.lat ?? point.position_lat), number(point.lon ?? point.lng ?? point.position_long), point.ele ?? point.altitude];
    return values[2] === undefined ? values.slice(0, 2) : values;
  }).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]) && (point[0] !== 0 || point[1] !== 0));
  if (clean.length <= maxPoints) return clean;
  const sampled = [];
  for (let index = 0; index < maxPoints; index += 1) sampled.push(clean[Math.round(index * (clean.length - 1) / (maxPoints - 1))]);
  return sampled;
}

export function decodePolyline(encoded = '') {
  const points = [];
  let index = 0, lat = 0, lon = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

export function normalizeActivity(input, source = 'file') {
  const sport = String(first(input, ['sport_type', 'type', 'sport', 'activity type']) || 'Ride');
  const startTime = first(input, ['start_date_local', 'start_date', 'startTime', 'date', 'activity date']) || new Date().toISOString();
  let distance = number(first(input, ['distanceKm', 'distance_km', 'distance', 'distance (km)', '距离']));
  if (distance > 1000) distance /= 1000;
  const seconds = parseDuration(first(input, ['movingSeconds', 'moving_time', 'elapsed_time', 'duration', 'moving time', 'elapsed time']));
  const speed = number(first(input, ['avgSpeedKmh', 'average_speed', 'avg_speed', 'average speed']));
  const speedKmh = speed > 0 && speed < 15 ? speed * 3.6 : speed;
  const sourceId = first(input, ['sourceId', 'id', 'activity id']);
  const routeInput = input.route || (input.map?.summary_polyline ? decodePolyline(input.map.summary_polyline) : []);
  const activity = {
    id: String(first(input, ['_localId']) || stableId(source, sourceId, startTime, distance)),
    source,
    sourceId: sourceId ? String(sourceId) : null,
    name: String(first(input, ['name', 'activity name', 'title']) || '骑行'),
    sport,
    startTime: new Date(startTime).toISOString(),
    date: dateKey(startTime),
    distanceKm: Math.max(0, Number(distance.toFixed(2))),
    movingSeconds: Math.max(0, Math.round(seconds)),
    elevationM: Math.max(0, Math.round(number(first(input, ['elevationM', 'total_elevation_gain', 'elevation gain', 'elevation', '累计爬升'])))),
    avgSpeedKmh: Math.max(0, Number((speedKmh || (seconds ? distance / (seconds / 3600) : 0)).toFixed(1))),
    calories: Math.max(0, Math.round(number(first(input, ['calories', '卡路里'])))),
    route: simplifyRoute(routeInput),
  };
  return activity;
}

export function isRide(activity) {
  return RIDE_TYPES.has(String(activity.sport).replace(/\s/g, '').toLowerCase());
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCsv(text, source = 'file') {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, delimiter);
    return normalizeActivity(Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])), source);
  }).filter(activity => activity.distanceKm > 0 && isRide(activity));
}

function haversine(a, b) {
  const rad = degree => degree * Math.PI / 180;
  const earth = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function parseGpx(text, source = 'igpsport') {
  const pointPattern = /<trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  const points = [];
  for (const match of text.matchAll(pointPattern)) {
    const body = match[3];
    points.push({
      lat: number(match[1]), lon: number(match[2]),
      ele: number(body.match(/<ele>([^<]+)<\/ele>/i)?.[1]),
      time: body.match(/<time>([^<]+)<\/time>/i)?.[1],
    });
  }
  if (points.length < 2) return [];
  let distanceKm = 0;
  let elevationM = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversine(points[index - 1], points[index]);
    elevationM += Math.max(0, points[index].ele - points[index - 1].ele);
  }
  const start = points.find(point => point.time)?.time || new Date().toISOString();
  const end = [...points].reverse().find(point => point.time)?.time || start;
  const name = text.match(/<name>([^<]+)<\/name>/i)?.[1] || 'iGPSPORT 骑行';
  return [normalizeActivity({ name, sport: 'Ride', startTime: start, distanceKm, movingSeconds: Math.max(0, (new Date(end) - new Date(start)) / 1000), elevationM, route: points }, source)];
}

export function parseJson(text, source = 'file') {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.activities || [parsed];
  return rows.map(row => normalizeActivity(row, source)).filter(activity => activity.distanceKm > 0 && isRide(activity));
}

export function mergeActivities(current, incoming) {
  const merged = new Map(current.map(activity => [activity.id, activity]));
  for (const activity of incoming) merged.set(activity.id, activity);
  return [...merged.values()].sort((a, b) => b.startTime.localeCompare(a.startTime));
}

export function summarize(activities, year) {
  const selected = activities.filter(activity => activity.date.startsWith(`${year}-`) && isRide(activity));
  const distanceKm = selected.reduce((sum, item) => sum + item.distanceKm, 0);
  const movingSeconds = selected.reduce((sum, item) => sum + item.movingSeconds, 0);
  const elevationM = selected.reduce((sum, item) => sum + item.elevationM, 0);
  const dayTotals = {};
  const monthTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, distanceKm: 0, rides: 0, elevationM: 0 }));
  for (const activity of selected) {
    dayTotals[activity.date] = dayTotals[activity.date] || { distanceKm: 0, rides: 0, movingSeconds: 0, elevationM: 0 };
    dayTotals[activity.date].distanceKm += activity.distanceKm;
    dayTotals[activity.date].rides += 1;
    dayTotals[activity.date].movingSeconds += activity.movingSeconds;
    dayTotals[activity.date].elevationM += activity.elevationM;
    const month = Number(activity.date.slice(5, 7)) - 1;
    monthTotals[month].distanceKm += activity.distanceKm;
    monthTotals[month].rides += 1;
    monthTotals[month].elevationM += activity.elevationM;
  }
  Object.values(dayTotals).forEach(day => { day.distanceKm = Number(day.distanceKm.toFixed(1)); });
  monthTotals.forEach(month => { month.distanceKm = Number(month.distanceKm.toFixed(1)); });
  const days = Object.keys(dayTotals).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let prior = null;
  for (const day of days) {
    const date = new Date(`${day}T00:00:00Z`);
    currentStreak = prior && (date - prior) / 86400000 === 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    prior = date;
  }
  const activeMonths = Math.max(1, monthTotals.filter(month => month.rides).length);
  const projected = Math.round(distanceKm / activeMonths * 12);
  return {
    year, rides: selected.length, distanceKm: Number(distanceKm.toFixed(1)), movingSeconds,
    elevationM: Math.round(elevationM), activeDays: days.length, longestStreak,
    averageRideKm: selected.length ? Number((distanceKm / selected.length).toFixed(1)) : 0,
    projectedKm: projected, dayTotals, monthTotals,
    recent: selected.slice(0, 8),
  };
}

export function summarizeCareer(activities, currentYear = new Date().getFullYear()) {
  const selected = activities.filter(isRide).sort((a, b) => b.startTime.localeCompare(a.startTime));
  const years = [...new Set(selected.map(activity => Number(activity.date.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => a - b);
  const yearTotals = years.map(year => {
    const summary = summarize(selected, year);
    return {
      year,
      rides: summary.rides,
      distanceKm: summary.distanceKm,
      movingSeconds: summary.movingSeconds,
      elevationM: summary.elevationM,
      activeDays: summary.activeDays,
    };
  });
  const distanceKm = selected.reduce((sum, item) => sum + item.distanceKm, 0);
  const movingSeconds = selected.reduce((sum, item) => sum + item.movingSeconds, 0);
  const elevationM = selected.reduce((sum, item) => sum + item.elevationM, 0);
  const days = [...new Set(selected.map(activity => activity.date))].sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let prior = null;
  for (const day of days) {
    const date = new Date(`${day}T00:00:00Z`);
    currentStreak = prior && (date - prior) / 86400000 === 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    prior = date;
  }
  const bestYear = yearTotals.reduce((best, item) => !best || item.distanceKm >= best.distanceKm ? item : best, null);
  return {
    scope: 'career', year: 'career', rides: selected.length,
    distanceKm: Number(distanceKm.toFixed(1)), movingSeconds, elevationM: Math.round(elevationM),
    activeDays: days.length, longestStreak,
    averageRideKm: selected.length ? Number((distanceKm / selected.length).toFixed(1)) : 0,
    yearsRiding: yearTotals.length,
    firstRideDate: selected.at(-1)?.date || null,
    latestRideDate: selected[0]?.date || null,
    yearTotals, bestYear,
    currentYear: summarize(selected, currentYear),
    recent: selected.slice(0, 8),
  };
}

export function seedActivities(year = new Date().getFullYear()) {
  const names = ['江边晨骑', '环湖耐力', '下班追风', '周末爬坡', '城市恢复骑', '咖啡店巡航'];
  const activities = [];
  const today = new Date();
  const lastMonth = year === today.getFullYear() ? today.getMonth() : 11;
  let index = 0;
  for (let month = 0; month <= lastMonth; month += 1) {
    const rideDays = [2, 6, 10, 15, 19, 23, 27].slice(0, 4 + (month % 4));
    for (const day of rideDays) {
      if (year === today.getFullYear() && month === today.getMonth() && day > today.getDate()) continue;
      const distanceKm = 22 + ((month * 19 + day * 7) % 74);
      const hours = distanceKm / (23 + (index % 5));
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const route = Array.from({ length: 96 }, (_, routeIndex) => {
        const angle = routeIndex / 95 * Math.PI * 2;
        const ripple = 1 + Math.sin(angle * (3 + index % 3)) * .19 + Math.cos(angle * 5) * .08;
        const baseLat = 31.19 + month * .003;
        const baseLon = 121.43 + (index % 5) * .005;
        return [baseLat + Math.sin(angle) * .035 * ripple, baseLon + Math.cos(angle) * .048 * ripple + Math.sin(angle * 2) * .01];
      });
      activities.push(normalizeActivity({
        _localId: `demo-${year}-${index}`, name: names[index % names.length], sport: 'Ride',
        startTime: `${date}T${String(6 + (index % 12)).padStart(2, '0')}:20:00+08:00`,
        distanceKm, movingSeconds: Math.round(hours * 3600), elevationM: 80 + ((index * 137) % 860),
        calories: Math.round(distanceKm * 22), route,
      }, index % 3 === 0 ? 'igpsport' : 'strava'));
      index += 1;
    }
  }
  return activities.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
