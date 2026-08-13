const CHINA_API = 'https://prod.zh.igpsport.com';
const GLOBAL_API = 'https://prod.en.igpsport.com';
const ALLOWED_API_HOSTS = new Set(['prod.zh.igpsport.com', 'prod.en.igpsport.com']);

function tokenizeCurl(input) {
  const normalized = input.replace(/\\\r?\n/g, ' ');
  const tokens = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (const character of normalized) {
    if (escaped) { current += character; escaped = false; continue; }
    if (character === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (character === quote) quote = '';
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (/\s/.test(character)) {
      if (current) { tokens.push(current); current = ''; }
    } else current += character;
  }
  if (escaped || quote) throw new Error('curl 内容不完整，请复制完整请求');
  if (current) tokens.push(current);
  return tokens;
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch { return null; }
}

export function parseIgpsportCurl(input) {
  if (typeof input !== 'string' || input.length > 50_000) throw new Error('curl 内容无效或过长');
  const tokens = tokenizeCurl(input.trim());
  if (tokens[0] !== 'curl') throw new Error('请粘贴以 curl 开头的完整请求');
  let requestUrl = '';
  let authorization = '';
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-H' || token === '--header') {
      const header = tokens[++index] || '';
      const separator = header.indexOf(':');
      if (separator > 0 && header.slice(0, separator).trim().toLowerCase() === 'authorization') authorization = header.slice(separator + 1).trim();
      continue;
    }
    if (token.startsWith('--header=')) {
      const header = token.slice(9);
      const separator = header.indexOf(':');
      if (separator > 0 && header.slice(0, separator).trim().toLowerCase() === 'authorization') authorization = header.slice(separator + 1).trim();
      continue;
    }
    if (token === '-X' || token === '--request' || token === '-A' || token === '--user-agent' || token === '-e' || token === '--referer') { index += 1; continue; }
    if (!token.startsWith('-') && /^https?:\/\//i.test(token)) requestUrl = token;
  }
  let url;
  try { url = new URL(requestUrl); } catch { throw new Error('没有识别到 iGPSPORT 请求地址'); }
  if (url.protocol !== 'https:' || !ALLOWED_API_HOSTS.has(url.hostname)) throw new Error('只接受 iGPSPORT 中国区或国际区官方接口请求');
  if (!url.pathname.includes('/activity/')) throw new Error('请复制 iGPSPORT 活动列表中的任意请求');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer || bearer.length < 40) throw new Error('没有识别到 Authorization Bearer Token');
  const payload = decodeJwt(bearer);
  const expiresAt = typeof payload?.exp === 'number' ? new Date(payload.exp * 1000) : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) throw new Error('这个 Token 已经过期，请刷新 iGPSPORT 页面后重新复制');
  const memberId = payload?.memberid ?? payload?.memberId ?? payload?.sub;
  return {
    token: bearer,
    apiBase: url.hostname === 'prod.en.igpsport.com' ? GLOBAL_API : CHINA_API,
    expiresAt,
    memberId: memberId === undefined || memberId === null ? null : String(memberId),
  };
}

export function parseIgpsportToken(input, region = 'cn') {
  if (typeof input !== 'string' || input.length > 10_000) throw new Error('Token 内容无效或过长');
  const bearer = input.trim().replace(/^Bearer\s+/i, '');
  if (bearer.length < 40) throw new Error('请输入完整的 Bearer Token');
  const payload = decodeJwt(bearer);
  const expiresAt = typeof payload?.exp === 'number' ? new Date(payload.exp * 1000) : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) throw new Error('这个 Token 已经过期，请刷新 iGPSPORT 页面后重新复制');
  const memberId = payload?.memberid ?? payload?.memberId ?? payload?.sub;
  return {
    token: bearer,
    apiBase: region === 'global' ? GLOBAL_API : CHINA_API,
    expiresAt,
    memberId: memberId === undefined || memberId === null ? null : String(memberId),
  };
}
