import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePolyline, mergeActivities, normalizeActivity, parseCsv, parseGpx, simplifyRoute, summarize, summarizeCareer } from '../lib/activities.js';

test('normalizes Strava meters and seconds', () => {
  const activity = normalizeActivity({ id: 12, name: 'Morning Ride', sport_type: 'Ride', start_date_local: '2026-04-03T07:00:00+08:00', distance: 42500, moving_time: 5400, total_elevation_gain: 380, average_speed: 7.8 }, 'strava');
  assert.equal(activity.distanceKm, 42.5);
  assert.equal(activity.avgSpeedKmh, 28.1);
  assert.equal(activity.date, '2026-04-03');
});

test('parses common Strava CSV export columns', () => {
  const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Elevation Gain\n99,2026-05-08T09:00:00Z,Sunday spin,Ride,01:30:00,48.2,410';
  const activities = parseCsv(csv, 'strava');
  assert.equal(activities.length, 1);
  assert.equal(activities[0].movingSeconds, 5400);
});

test('parses a minimal GPX track', () => {
  const gpx = '<gpx><trk><name>River loop</name><trkseg><trkpt lat="31.20" lon="121.40"><ele>5</ele><time>2026-06-01T00:00:00Z</time></trkpt><trkpt lat="31.21" lon="121.41"><ele>15</ele><time>2026-06-01T00:05:00Z</time></trkpt></trkseg></trk></gpx>';
  const [activity] = parseGpx(gpx);
  assert.ok(activity.distanceKm > 1);
  assert.equal(activity.elevationM, 10);
  assert.equal(activity.movingSeconds, 300);
  assert.equal(activity.route.length, 2);
  assert.deepEqual(activity.route[0].slice(0, 2), [31.2, 121.4]);
});

test('decodes Strava polyline routes and caps stored points', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  const route = Array.from({ length: 1000 }, (_, index) => [31 + index / 10000, 121 + index / 10000]);
  const activity = normalizeActivity({ sport: 'Ride', startTime: '2026-01-01', distanceKm: 10, route }, 'file');
  assert.equal(activity.route.length, 500);
  assert.deepEqual(simplifyRoute(route, 20).at(-1), route.at(-1));
});

test('merges duplicates and calculates summary', () => {
  const a = normalizeActivity({ _localId: 'same', sport: 'Ride', startTime: '2026-01-01T08:00:00Z', distanceKm: 20, movingSeconds: 3600 }, 'file');
  const b = { ...a, distanceKm: 25 };
  const merged = mergeActivities([a], [b]);
  const summary = summarize(merged, 2026);
  assert.equal(merged.length, 1);
  assert.equal(summary.distanceKm, 25);
  assert.equal(summary.activeDays, 1);
});

test('summarizes a riding career by year and keeps the current goal context', () => {
  const activities = [
    normalizeActivity({ _localId: 'old', sport: 'Ride', startTime: '2025-06-01T08:00:00Z', distanceKm: 80, movingSeconds: 10800, elevationM: 500 }, 'file'),
    normalizeActivity({ _localId: 'new', sport: 'Ride', startTime: '2026-06-01T08:00:00Z', distanceKm: 40, movingSeconds: 5400, elevationM: 200 }, 'file'),
  ];
  const career = summarizeCareer(activities, 2026);
  assert.equal(career.distanceKm, 120);
  assert.equal(career.yearsRiding, 2);
  assert.equal(career.bestYear.year, 2025);
  assert.equal(career.currentYear.distanceKm, 40);
  assert.deepEqual(career.yearTotals.map(item => item.year), [2025, 2026]);
});
