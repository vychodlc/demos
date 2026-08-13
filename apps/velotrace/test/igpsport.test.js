import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIgpsportCurl, parseIgpsportToken } from '../lib/igpsport-curl.js';

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

test('extracts an iGPSPORT bearer token without executing curl', () => {
  const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600, memberid: '42' });
  const credential = parseIgpsportCurl(`curl 'https://prod.zh.igpsport.com/service/web-gateway/web-analyze/activity/queryMyActivity?pageNo=1' -H 'authorization: Bearer ${token}' -H 'x-signature: ignored'`);
  assert.equal(credential.token, token);
  assert.equal(credential.apiBase, 'https://prod.zh.igpsport.com');
  assert.equal(credential.memberId, '42');
});

test('extracts a bearer token from a multiline curl command', () => {
  const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  const credential = parseIgpsportCurl(`curl 'https://prod.en.igpsport.com/service/web-gateway/web-analyze/activity/queryMyActivity' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer ${token}'`);
  assert.equal(credential.apiBase, 'https://prod.en.igpsport.com');
});

test('rejects curl requests to untrusted hosts', () => {
  const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  assert.throws(() => parseIgpsportCurl(`curl 'https://example.com/activity/list' -H 'authorization: Bearer ${token}'`), /只接受 iGPSPORT/);
});

test('rejects expired tokens', () => {
  const token = jwt({ exp: 1, padding: 'x'.repeat(80) });
  assert.throws(() => parseIgpsportCurl(`curl 'https://prod.en.igpsport.com/service/activity/list' -H 'authorization: Bearer ${token}'`), /已经过期/);
});

test('accepts a plain bearer token for the simpler flow', () => {
  const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600, padding: 'x'.repeat(80) });
  assert.equal(parseIgpsportToken(`Bearer ${token}`, 'global').apiBase, 'https://prod.en.igpsport.com');
});
