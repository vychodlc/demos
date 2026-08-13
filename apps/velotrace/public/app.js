const state = {
  year: new Date().getFullYear(), view: 'year', month: new Date().getMonth(),
  summary: null, activities: [], routes: [], selectedRoute: null, files: [], goal: 5000,
};

const APP_BASE = '';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fmt = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value || 0);
const duration = seconds => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}`;
const monthName = index => `${index + 1}月`;
const monthLong = index => `${index + 1} 月`;
const safe = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const isCareer = () => state.year === 'career';
let igpsportCredentialMode = 'curl';

function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

async function request(url, options) {
  const response = await fetch(`${APP_BASE}${url}`, options);
  const payload = await response.json();
  if (response.status === 401) { window.location.href = `${APP_BASE}/login`; throw new Error('请先登录'); }
  if (!response.ok) throw new Error(payload.error || payload.errors?.join('；') || '请求失败');
  return payload;
}

function level(distance) {
  if (!distance) return 0;
  if (distance < 25) return 1;
  if (distance < 50) return 2;
  if (distance < 80) return 3;
  return 4;
}

function populateYears(activities = state.activities) {
  const select = $('#yearSelect');
  const years = new Set(activities.map(activity => Number(activity.date.slice(0, 4))).filter(Number.isFinite));
  years.add(new Date().getFullYear());
  select.innerHTML = '';
  select.add(new Option('生涯', 'career'));
  [...years].sort((a, b) => b - a).forEach(year => select.add(new Option(`${year} 年`, year)));
  select.value = state.year;
}

function renderMetrics() {
  const s = state.summary;
  const goalSummary = s.currentYear || s;
  const career = isCareer();
  document.body.classList.toggle('career-mode', career);
  $('#dashboardEyebrow').textContent = career ? '你的骑行生涯' : '你的骑行控制台';
  $('#dashboardTitle').textContent = career ? '一路骑来。' : '继续向前。';
  $('#distanceLabel').textContent = career ? '生涯里程' : '年度里程';
  $('#distance').textContent = fmt(s.distanceKm);
  $('#rides').textContent = fmt(s.rides);
  $('#activeDays').textContent = fmt(s.activeDays);
  $('#hours').textContent = fmt(s.movingSeconds / 3600);
  $('#elevation').textContent = fmt(s.elevationM);
  $('#streak').textContent = s.longestStreak;
  $('#distanceDelta').textContent = career
    ? `${s.firstRideDate ? s.firstRideDate.slice(0, 4) : '—'} 至今 · ${fmt(s.yearsRiding)} 个骑行年份`
    : `预计全年 ${fmt(s.projectedKm)} 公里 · 每次出发都算数`;
  $('#climbCompare').textContent = s.elevationM > 8849 ? `相当于 ${Math.floor(s.elevationM / 8849)} 座珠峰` : `距离一座珠峰还差 ${fmt(8849 - s.elevationM)} 米`;
  const percent = Math.min(100, Math.round(goalSummary.distanceKm / state.goal * 100));
  const goalYearLabel = career ? '今年' : `${state.year} 年`;
  const currentGoal = career || state.year === new Date().getFullYear();
  $('#goalRing').style.setProperty('--progress', `${percent * 3.6}deg`);
  $('#goalPercent').textContent = `${percent}%`;
  $('#goalTitle').textContent = goalSummary.distanceKm >= state.goal ? `${goalYearLabel}目标已经达成` : `${goalYearLabel}还差 ${fmt(state.goal - goalSummary.distanceKm)} 公里`;
  const currentMonth = new Date().getMonth();
  const weekly = Math.max(1, Math.ceil((state.goal - goalSummary.distanceKm) / Math.max(1, 52 - Math.ceil((currentMonth + 1) / 12 * 52))));
  $('#goalHint').textContent = goalSummary.distanceKm >= state.goal
    ? (currentGoal ? '漂亮。现在可以把终点再推远一点。' : `那一年，你比目标多骑了 ${fmt(goalSummary.distanceKm - state.goal)} 公里。`)
    : (currentGoal ? `接下来每周骑 ${weekly} 公里，就能稳稳抵达。` : `回看这一年，目标完成度是 ${percent}%。`);
}

function dateRangeForYear(year) {
  const start = new Date(Date.UTC(year, 0, 1));
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(Date.UTC(year, 11, 31));
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end || cursor.getUTCDay() !== 1) {
    days.push(new Date(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function setTooltip(element, date, data) {
  element.addEventListener('mouseenter', event => {
    const tooltip = $('#tooltip');
    tooltip.textContent = data ? `${date} · ${data.distanceKm.toFixed(1)} km · ${data.rides} 次` : `${date} · 休息日`;
    tooltip.style.left = `${event.clientX}px`; tooltip.style.top = `${event.clientY}px`; tooltip.classList.add('show');
  });
  element.addEventListener('mousemove', event => { $('#tooltip').style.left = `${event.clientX}px`; $('#tooltip').style.top = `${event.clientY}px`; });
  element.addEventListener('mouseleave', () => $('#tooltip').classList.remove('show'));
}

function renderYear() {
  const heatmap = $('#heatmap');
  $('#calendarWrap').classList.remove('career');
  heatmap.className = 'heatmap'; heatmap.innerHTML = '';
  $('#monthLabels').style.display = 'grid';
  $('.weekday-labels').style.display = 'grid';
  dateRangeForYear(state.year).forEach(date => {
    const key = date.toISOString().slice(0, 10);
    const data = state.summary.dayTotals[key];
    const cell = document.createElement('button');
    cell.className = `day${date.getUTCFullYear() !== state.year ? ' outside' : ''}`;
    cell.dataset.level = level(data?.distanceKm);
    cell.setAttribute('aria-label', data ? `${key} 骑行 ${data.distanceKm} 公里` : `${key} 未骑行`);
    setTooltip(cell, key, data); heatmap.append(cell);
  });
}

function renderMonth() {
  const heatmap = $('#heatmap');
  $('#calendarWrap').classList.remove('career');
  heatmap.className = 'month-grid'; heatmap.innerHTML = '';
  $('#monthLabels').style.display = 'none'; $('.weekday-labels').style.display = 'none';
  const first = new Date(Date.UTC(state.year, state.month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
  for (let index = 0; index < offset; index += 1) heatmap.append(Object.assign(document.createElement('span'), { className: 'day outside' }));
  for (let day = 1; day <= days; day += 1) {
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const data = state.summary.dayTotals[key]; const cell = document.createElement('button');
    cell.className = 'day'; cell.dataset.level = level(data?.distanceKm);
    cell.innerHTML = `<b>${day}</b>${data ? `${data.distanceKm.toFixed(0)} km` : '—'}`;
    setTooltip(cell, key, data); heatmap.append(cell);
  }
}

function renderCareer() {
  const heatmap = $('#heatmap');
  const totals = [...state.summary.yearTotals].sort((a, b) => b.year - a.year);
  const maxDistance = Math.max(1, ...totals.map(item => item.distanceKm));
  $('#calendarWrap').classList.add('career');
  $('#monthLabels').style.display = 'none';
  $('.weekday-labels').style.display = 'none';
  heatmap.className = 'career-timeline';
  heatmap.innerHTML = totals.map(item => {
    const width = Math.max(4, item.distanceKm / maxDistance * 100);
    const best = item.year === state.summary.bestYear?.year;
    return `<button class="career-year${best ? ' best' : ''}" data-year="${item.year}">
      <strong>${item.year}</strong>
      <span class="career-bar"><i style="--width:${width}%"></i></span>
      <b>${fmt(item.distanceKm)} km${best ? '<em>最佳</em>' : ''}</b>
      <small>${fmt(item.rides)} 次 · ${fmt(item.activeDays)} 个活跃日</small>
      <span class="career-arrow">→</span>
    </button>`;
  }).join('') || '<p class="dialog-copy">导入第一条骑行，生涯就从这里开始。</p>';
  $$('.career-year').forEach(button => button.addEventListener('click', async () => {
    state.year = Number(button.dataset.year);
    state.view = 'year';
    $$('.segmented button').forEach(item => item.classList.toggle('active', item.dataset.view === 'year'));
    state.month = state.year === new Date().getFullYear() ? new Date().getMonth() : 0;
    $('#yearSelect').value = state.year;
    await load();
  }));
}

function updatePeriodNav() {
  const nav = $('#periodNav'); nav.hidden = isCareer() || state.view === 'year';
  if (state.view === 'month') $('#periodLabel').textContent = `${state.year} 年 ${state.month + 1} 月`;
}

function renderCalendar() {
  updatePeriodNav();
  $('#calendarSegmented').hidden = isCareer();
  $('#calendarLegend').hidden = isCareer();
  $('#calendarEyebrow').textContent = isCareer() ? 'CAREER / 生涯' : 'CONSISTENCY / 持续性';
  $('#calendarTitle').textContent = isCareer() ? '每一年，都让生涯更长一点' : '每一格，都是你出发过的证明';
  $('#calendarNote').textContent = isCareer() ? '个骑行年份 · 点击年份查看细节' : '天最长连续骑行';
  if (isCareer()) {
    $('#streak').textContent = state.summary.yearsRiding;
    renderCareer();
  } else state.view === 'year' ? renderYear() : renderMonth();
}

async function changePeriod(direction) {
  let nextYear = state.year;
  if (state.view === 'month') {
    state.month += direction;
    if (state.month < 0) { state.month = 11; nextYear -= 1; }
    if (state.month > 11) { state.month = 0; nextYear += 1; }
  }
  if (nextYear !== state.year) {
    state.year = nextYear;
    const select = $('#yearSelect');
    if (![...select.options].some(option => Number(option.value) === nextYear)) select.add(new Option(nextYear, nextYear));
    select.value = nextYear; await load();
  } else renderCalendar();
}

function renderChart() {
  let values;
  let labels;
  let titles;
  if (isCareer()) {
    let cumulative = 0;
    const totals = [...state.summary.yearTotals].sort((a, b) => a.year - b.year);
    values = totals.map(item => (cumulative += item.distanceKm));
    labels = totals.map(item => String(item.year));
    titles = totals.map((item, index) => `${item.year} · 累计 ${fmt(values[index])} km`);
    $('#trendEyebrow').textContent = 'CAREER GROWTH / 生涯成长';
    $('#trendTitle').textContent = '累计里程';
    $('#averageRide').textContent = fmt(state.summary.distanceKm);
    $('#trendUnit').textContent = '生涯公里';
  } else {
    values = state.summary.monthTotals.map(item => item.distanceKm);
    labels = values.map((_, index) => monthName(index));
    titles = values.map((value, index) => `${monthLong(index)} · ${value} km`);
    $('#trendEyebrow').textContent = 'DISTANCE / 里程';
    $('#trendTitle').textContent = '月度节奏';
    $('#averageRide').textContent = state.summary.averageRideKm.toFixed(1);
    $('#trendUnit').textContent = '公里 / 次';
  }
  if (!values.length) { $('#trendChart').innerHTML = '<p class="dialog-copy">还没有足够的数据画出趋势。</p>'; return; }
  const width = 800, height = 220, pad = 25, base = 186;
  const max = Math.max(100, ...values) * 1.15;
  const denominator = Math.max(1, values.length - 1);
  const points = values.map((value, index) => [pad + index * ((width - pad * 2) / denominator), base - value / max * 145]);
  const line = points.map(point => point.join(',')).join(' ');
  const endX = points.at(-1)[0];
  const area = `${pad},${base} ${line} ${endX},${base}`;
  const grids = [0, .33, .66, 1].map(fraction => `<line class="grid" x1="${pad}" y1="${base - fraction * 145}" x2="${width - pad}" y2="${base - fraction * 145}"/>`).join('');
  const labelElements = points.map((point, index) => `<text x="${point[0]}" y="214" text-anchor="middle">${labels[index]}</text>`).join('');
  const dots = points.map((point, index) => `<circle class="point" cx="${point[0]}" cy="${point[1]}" r="4"><title>${titles[index]}</title></circle>`).join('');
  $('#trendChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ff45" stop-opacity=".18"/><stop offset="1" stop-color="#d8ff45" stop-opacity="0"/></linearGradient></defs>${grids}<polygon class="area" points="${area}"/><polyline class="line" points="${line}"/>${dots}${labelElements}</svg>`;
}

function projectRoute(route, width, height, padding = 30) {
  if (!route?.length) return [];
  const latitude = route.reduce((sum, point) => sum + point[0], 0) / route.length;
  const adjusted = route.map(point => ({ x: point[1] * Math.cos(latitude * Math.PI / 180), y: point[0] }));
  const xs = adjusted.map(point => point.x), ys = adjusted.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - padding * 2) / Math.max(.000001, maxX - minX), (height - padding * 2) / Math.max(.000001, maxY - minY));
  const usedWidth = (maxX - minX) * scale, usedHeight = (maxY - minY) * scale;
  const offsetX = (width - usedWidth) / 2, offsetY = (height - usedHeight) / 2;
  return adjusted.map(point => [offsetX + (point.x - minX) * scale, height - offsetY - (point.y - minY) * scale]);
}

function svgPath(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ');
}

function selectRoute(id, shouldScroll = false) {
  state.selectedRoute = state.routes.find(route => route.id === id) || state.routes[0] || null;
  renderRoute();
  if (shouldScroll) $('#routes').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRoute() {
  const ride = state.selectedRoute;
  const svg = $('#routeMap');
  if (!ride) {
    svg.innerHTML = '<text x="380" y="250" text-anchor="middle" fill="#8d9585" font-size="13">导入 GPX / FIT，或连接 Strava 后查看轨迹</text>';
    $('#routeName').textContent = '还没有路线'; $('#routeDate').textContent = '汇总 CSV 不包含 GPS 轨迹';
    $('#routeDistance').textContent = '—'; $('#routeTime').textContent = '—'; $('#routeElevation').textContent = '—';
    $('#routePicker').innerHTML = ''; $('#shareRoute').disabled = true; return;
  }
  $('#shareRoute').disabled = false;
  const points = projectRoute(ride.route, 700, 440, 34).map(point => [point[0] + 30, point[1] + 30]);
  const path = svgPath(points); const start = points[0], end = points.at(-1);
  svg.innerHTML = `<path class="route-shadow" d="${path}"/><path class="route-line" d="${path}"/><circle class="route-start" cx="${start[0]}" cy="${start[1]}" r="7"/><circle class="route-end" cx="${end[0]}" cy="${end[1]}" r="7"/>`;
  $('#routeName').textContent = ride.name;
  $('#routeDate').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(ride.startTime));
  $('#routeDistance').textContent = ride.distanceKm.toFixed(1); $('#routeTime').textContent = duration(ride.movingSeconds); $('#routeElevation').textContent = fmt(ride.elevationM);
  $('#routePicker').innerHTML = state.routes.slice(0, 8).map(route => `<button class="route-choice${route.id === ride.id ? ' active' : ''}" data-route-id="${safe(route.id)}"><div><span>${safe(route.name)}</span><small>${safe(route.date)} · ${safe(route.source)}</small></div><b>${route.distanceKm.toFixed(0)} km</b></button>`).join('');
  $$('.route-choice').forEach(button => button.addEventListener('click', () => selectRoute(button.dataset.routeId)));
}

function drawPoster() {
  const ride = state.selectedRoute; if (!ride) return;
  const canvas = $('#shareCanvas'), context = canvas.getContext('2d');
  const hideEndpoints = $('#hideEndpoints').checked;
  const crop = hideEndpoints ? Math.floor(ride.route.length * .08) : 0;
  const route = ride.route.slice(crop, Math.max(crop + 2, ride.route.length - crop));
  const points = projectRoute(route, 880, 650, 55).map(point => [point[0] + 100, point[1] + 255]);
  context.fillStyle = '#0c0e0b'; context.fillRect(0, 0, 1080, 1350);
  context.strokeStyle = '#191d17'; context.lineWidth = 2;
  for (let x = 0; x <= 1080; x += 60) { context.beginPath(); context.moveTo(x, 220); context.lineTo(x, 940); context.stroke(); }
  for (let y = 220; y <= 940; y += 60) { context.beginPath(); context.moveTo(0, y); context.lineTo(1080, y); context.stroke(); }
  const routePath = () => { context.beginPath(); points.forEach((point, index) => index ? context.lineTo(...point) : context.moveTo(...point)); };
  context.save(); context.lineCap = 'round'; context.lineJoin = 'round';
  routePath(); context.strokeStyle = 'rgba(216,255,69,.15)'; context.lineWidth = 34; context.shadowColor = '#d8ff45'; context.shadowBlur = 40; context.stroke();
  routePath(); context.strokeStyle = '#d8ff45'; context.lineWidth = 9; context.shadowBlur = 0; context.stroke(); context.restore();
  const mark = (point, fill) => { context.beginPath(); context.arc(point[0], point[1], 13, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); context.lineWidth = 7; context.strokeStyle = '#0c0e0b'; context.stroke(); };
  mark(points[0], '#0c0e0b'); context.strokeStyle = '#d8ff45'; context.lineWidth = 5; context.stroke(); mark(points.at(-1), '#d8ff45');
  context.fillStyle = '#d8ff45'; context.font = '800 25px Inter, sans-serif'; context.letterSpacing = '5px'; context.fillText('VELOTRACE / RIDE STORY', 76, 86);
  context.fillStyle = '#f4f5ed'; context.font = '900 64px Inter, sans-serif'; context.letterSpacing = '-2px'; context.fillText(ride.name.slice(0, 14), 76, 175);
  context.fillStyle = '#8d9585'; context.font = '500 24px Inter, sans-serif'; context.letterSpacing = '0px'; context.fillText(new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ride.startTime)), 78, 215);
  context.fillStyle = '#f4f5ed'; context.font = '900 70px Inter, sans-serif'; context.fillText(ride.distanceKm.toFixed(1), 76, 1055);
  context.fillStyle = '#8d9585'; context.font = '600 21px Inter, sans-serif'; context.fillText('公里', 266, 1055);
  const stats = [[duration(ride.movingSeconds), '移动时间'], [`${fmt(ride.elevationM)} m`, '累计爬升'], [`${ride.avgSpeedKmh.toFixed(1)} km/h`, '平均速度']];
  stats.forEach(([value, label], index) => { const x = 76 + index * 300; context.fillStyle = '#f4f5ed'; context.font = '800 29px Inter, sans-serif'; context.fillText(value, x, 1135); context.fillStyle = '#70786b'; context.font = '500 18px Inter, sans-serif'; context.fillText(label, x, 1170); });
  context.fillStyle = '#b6bbaa'; context.font = '500 25px Inter, sans-serif'; context.fillText(`“${($('#shareCaption').value || '').slice(0, 42)}”`, 76, 1253);
  context.fillStyle = '#d8ff45'; context.fillRect(76, 1298, 90, 5); context.fillStyle = '#70786b'; context.font = '600 17px Inter, sans-serif'; context.fillText(hideEndpoints ? 'PRIVACY CROP ON · MADE WITH VELOTRACE' : 'FULL ROUTE · MADE WITH VELOTRACE', 185, 1305);
}

function openShare() { if (!state.selectedRoute) return; drawPoster(); $('#shareDialog').showModal(); }

function downloadPoster() {
  drawPoster(); const link = document.createElement('a');
  link.download = `velotrace-${state.selectedRoute.date}.png`; link.href = $('#shareCanvas').toDataURL('image/png'); link.click(); showToast('分享图已生成');
}

const navLinks = $$('nav .nav-item[href^="#"]');
const navSections = navLinks.map(link => ({ link, id: link.hash.slice(1), section: document.querySelector(link.hash) })).filter(item => item.section);

function setActiveNav(id) {
  navLinks.forEach(link => {
    const active = link.hash === `#${id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

function activeSectionFromScroll() {
  const anchor = window.scrollY + Math.min(240, window.innerHeight * .35);
  const sections = navSections.filter(item => item.id !== 'goals').map(item => ({ ...item, top: item.section.getBoundingClientRect().top + window.scrollY })).sort((a, b) => a.top - b.top);
  let active = sections[0]?.id || 'overview';
  for (const item of sections) if (item.top <= anchor) active = item.id;
  const hash = location.hash.slice(1);
  if ((hash === 'goals' || hash === 'trends') && active === 'trends') active = hash;
  return active;
}

let navFrame = null;
function syncActiveNav() {
  if (navFrame) return;
  navFrame = requestAnimationFrame(() => {
    navFrame = null;
    if (Date.now() < syncActiveNav.lockedUntil) return;
    setActiveNav(activeSectionFromScroll());
  });
}

syncActiveNav.lockedUntil = 0;
navLinks.forEach(link => link.addEventListener('click', () => {
  syncActiveNav.lockedUntil = Date.now() + 800;
  setActiveNav(link.hash.slice(1));
}));
window.addEventListener('scroll', syncActiveNav, { passive: true });
window.addEventListener('hashchange', () => setActiveNav(location.hash.slice(1) || activeSectionFromScroll()));
setActiveNav(location.hash.slice(1) || activeSectionFromScroll());

function renderRides() {
  $('#rideList').innerHTML = state.summary.recent.map(ride => {
    const date = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(ride.startTime));
    return `<article class="ride-row${ride.route?.length > 1 ? ' has-route' : ''}" data-route-id="${safe(ride.id)}"><div class="ride-title"><span class="ride-icon">⌁</span><div><strong>${safe(ride.name)}</strong><small>${date}</small></div></div><div class="ride-stat"><strong>${ride.distanceKm.toFixed(1)} km</strong><small>距离</small></div><div class="ride-stat"><strong>${duration(ride.movingSeconds)}</strong><small>时间</small></div><div class="ride-stat"><strong>${fmt(ride.elevationM)} m</strong><small>爬升</small></div><div class="ride-stat"><strong>${ride.avgSpeedKmh.toFixed(1)}</strong><small>均速 km/h</small></div><span class="source">${ride.route?.length > 1 ? '查看轨迹' : safe(ride.source)}</span></article>`;
  }).join('') || '<p class="dialog-copy">这一年还没有骑行。导入数据，点亮第一格。</p>';
  $$('.ride-row.has-route').forEach(row => row.addEventListener('click', () => selectRoute(row.dataset.routeId, true)));
}

async function load() {
  document.body.classList.add('loading');
  try {
    const [summary, activities, session] = await Promise.all([request(`/api/summary?year=${state.year}`), request('/api/activities'), request('/api/me')]);
    state.summary = summary; state.activities = activities; state.goal = session.user.annualGoal;
    populateYears();
    state.routes = state.activities.filter(activity => (isCareer() || activity.date.startsWith(`${state.year}-`)) && activity.route?.length > 1);
    if (!state.routes.some(route => route.id === state.selectedRoute?.id)) state.selectedRoute = state.routes[0] || null;
    renderMetrics(); renderCalendar(); renderChart(); renderRoute(); renderRides();
  } catch (error) { showToast(error.message); }
  document.body.classList.remove('loading');
}

function openImport() { $('#importDialog').showModal(); checkStrava(); }
function openIgpsport() {
  $('#importDialog').close();
  $('#igpsportProgress').hidden = true;
  $('#igpsportDialog').showModal();
  setTimeout(() => $('#igpsportCurl').focus(), 120);
}

function renderIgpsportTask(task) {
  const progress = $('#igpsportProgress'); progress.hidden = false;
  const percent = task.total ? Math.round(task.processed / task.total * 100) : 6;
  $('#igpsportProgressBar').style.width = `${Math.max(6, Math.min(100, percent))}%`;
  if (task.status === 'failed') {
    $('#igpsportProgressTitle').textContent = '同步没有完成';
    $('#igpsportProgressMeta').textContent = task.error || '请重新复制 curl 后再试';
  } else if (task.status === 'completed') {
    $('#igpsportProgressTitle').textContent = `已同步 ${task.imported} 条骑行`;
    $('#igpsportProgressMeta').textContent = task.skipped ? `${task.skipped} 条记录无法导入` : '轨迹与骑行数据已经更新';
  } else {
    $('#igpsportProgressTitle').textContent = task.total ? `正在同步 ${task.processed} / ${task.total}` : '正在读取活动…';
    $('#igpsportProgressMeta').textContent = `已导入 ${task.imported} 条${task.skipped ? ` · 跳过 ${task.skipped} 条` : ''}`;
  }
}

async function pollIgpsportTask(taskId) {
  while (true) {
    const { task } = await request(`/api/igpsport/tasks/${encodeURIComponent(taskId)}`);
    renderIgpsportTask(task);
    if (task.status === 'completed') {
      showToast(`iGPSPORT 已同步 ${task.imported} 条骑行`); await load(); return;
    }
    if (task.status === 'failed') throw new Error(task.error || 'iGPSPORT 同步失败');
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}

async function startIgpsportSync() {
  const button = $('#startIgpsportSync');
  button.disabled = true; button.textContent = '正在创建同步任务…';
  try {
    const value = $('#igpsportCurl').value;
    const result = await request('/api/igpsport/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: igpsportCredentialMode, curl: igpsportCredentialMode === 'curl' ? value : undefined, token: igpsportCredentialMode === 'token' ? value : undefined, region: $('#igpsportRegion select').value }) });
    $('#igpsportCurl').value = '';
    renderIgpsportTask(result.task);
    button.textContent = '同步进行中';
    await pollIgpsportTask(result.task.id);
    button.textContent = '同步完成';
  } catch (error) {
    showToast(error.message); button.disabled = false; button.textContent = '重新尝试';
  }
}
async function checkStrava() {
  try {
    const status = await request('/api/strava/status');
    $('#stravaStatus').textContent = status.connected ? '已连接，可以同步最新骑行' : status.configured ? '已配置，等待授权' : '需要在服务端配置 Strava API';
    $('#connectStrava').textContent = status.connected ? '同步 STRAVA' : '连接 STRAVA';
    $('#connectStrava').dataset.connected = status.connected;
  } catch { $('#stravaStatus').textContent = '暂时无法检查连接'; }
}

function selectFiles(files) {
  state.files = [...files];
  $('#selectedFiles').innerHTML = state.files.map(file => `<div class="file-chip"><span>${file.name}</span><span>${(file.size / 1024).toFixed(0)} KB</span></div>`).join('');
  $('#uploadFiles').disabled = !state.files.length;
}

async function uploadFiles() {
  const button = $('#uploadFiles'); button.disabled = true; button.textContent = '正在读取并导入…';
  try {
    const files = await Promise.all(state.files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = reject;
      reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] });
      reader.readAsDataURL(file);
    })));
    const result = await request('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    $('#importDialog').close(); showToast(`已导入 ${result.imported} 条骑行${result.errors.length ? `，${result.errors.length} 个文件失败` : ''}`); await load();
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.textContent = '导入所选文件'; }
}

populateYears(); load();
$('#yearSelect').addEventListener('change', event => {
  state.year = event.target.value === 'career' ? 'career' : Number(event.target.value);
  if (!isCareer()) state.month = state.year === new Date().getFullYear() ? new Date().getMonth() : 0;
  load();
});
[$('#importButton'), $('#openImport')].forEach(button => button.addEventListener('click', openImport));
$('#fileInput').addEventListener('change', event => selectFiles(event.target.files));
$('#uploadFiles').addEventListener('click', uploadFiles);
$('#openIgpsport').addEventListener('click', openIgpsport);
$('#igpsportCurl').addEventListener('input', event => { $('#startIgpsportSync').disabled = !event.target.value.trim(); });
$('#startIgpsportSync').addEventListener('click', startIgpsportSync);
$$('.credential-mode button').forEach(button => button.addEventListener('click', () => {
  igpsportCredentialMode = button.dataset.mode;
  $$('.credential-mode button').forEach(item => item.classList.toggle('active', item === button));
  const tokenMode = igpsportCredentialMode === 'token';
  $('#igpsportCredentialLabel').textContent = tokenMode ? 'Bearer Token' : 'iGPSPORT curl 请求';
  $('#igpsportCurl').placeholder = tokenMode ? 'eyJhbGciOiJSUzI1NiIs…' : "curl 'https://prod.zh.igpsport.com/…' \\\n  -H 'authorization: Bearer …'";
  $('#igpsportRegion').hidden = !tokenMode;
}));
const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', event => selectFiles(event.dataTransfer.files));
$$('.segmented button').forEach(button => button.addEventListener('click', () => {
  $$('.segmented button').forEach(item => item.classList.remove('active')); button.classList.add('active'); state.view = button.dataset.view;
  renderCalendar();
}));
$('#previousPeriod').addEventListener('click', () => changePeriod(-1));
$('#nextPeriod').addEventListener('click', () => changePeriod(1));
$('#connectStrava').addEventListener('click', async event => {
  if (event.currentTarget.dataset.connected === 'true') {
    event.currentTarget.disabled = true;
    try { const result = await request('/api/strava/sync', { method: 'POST' }); showToast(`已同步 ${result.imported} 条 Strava 骑行`); await load(); }
    catch (error) { showToast(error.message); } finally { event.currentTarget.disabled = false; }
  } else window.location.href = `${APP_BASE}/api/strava/connect`;
});
$('#syncButton').addEventListener('click', async () => {
  try { const status = await request('/api/strava/status'); if (!status.connected) return openImport(); await request('/api/strava/sync', { method: 'POST' }); showToast('同步完成'); await load(); }
  catch (error) { showToast(error.message); }
});
$('#editGoal').addEventListener('click', () => { $('#goalInput').value = state.goal; $('#goalDialog').showModal(); });
$('#saveGoal').addEventListener('click', async event => { event.preventDefault(); try { const result = await request('/api/goal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ annualGoal: Number($('#goalInput').value) }) }); state.goal = result.annualGoal; $('#goalDialog').close(); renderMetrics(); showToast('年度目标已更新'); } catch (error) { showToast(error.message); } });
$('#logoutButton')?.addEventListener('click', async () => { await request('/api/auth/logout', { method: 'POST' }); window.location.href = `${APP_BASE}/login`; });
$('#shareRoute').addEventListener('click', openShare);
$('#downloadShare').addEventListener('click', downloadPoster);
$('#hideEndpoints').addEventListener('change', drawPoster);
$('#shareCaption').addEventListener('input', drawPoster);
if (new URLSearchParams(location.search).get('strava') === 'connected') { history.replaceState({}, '', APP_BASE); showToast('Strava 已连接，准备同步'); }
