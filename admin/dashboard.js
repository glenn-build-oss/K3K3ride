/**
 * K3K3 Admin — Dashboard JS  v=20260615c
 * Fetches real data from 
 */

const API = '';
let currentPeriod = 'today';

// ── Helpers ──
const $ = id => document.getElementById(id);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
const escHtml = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(type, msg) {
  const c = $('toastContainer');
  if (!c) return;
  const colors = { success: 'var(--green)', error: 'var(--rose)', info: 'var(--blue)' };
  const icons  = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]||colors.info};margin-right:8px;"></i><span>${escHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ── Clock ──
(function clock() {
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const now = new Date();
    setText('hours',   pad(now.getHours()));
    setText('minutes', pad(now.getMinutes()));
    setText('seconds', pad(now.getSeconds()));
    const d = $('dateValue');
    if (d) d.textContent = now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });

    // Greeting
    const hr = now.getHours();
    const greeting = hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,';
    const g = $('greetingText');
    if (g) g.textContent = greeting;
  };
  tick();
  setInterval(tick, 1000);
})();

// ── Period tabs ──
document.querySelectorAll('.period-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPeriod = tab.dataset.period;
    loadTripsData();
  });
});

// ── Load all dashboard data ──
async function loadAllData() {
  await Promise.all([
    loadTripsData(),
    loadRiderStats(),
    loadApplicationStats(),
    loadCustomerStats(),
    checkSystemHealth(),
  ]);
}

// ── Trips ──
async function loadTripsData() {
  try {
    const res = await fetch(`${API}/trips/`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const trips = await res.json();

    // Period filter
    const now = new Date();
    let filtered = trips;
    if (currentPeriod === 'today') {
      const today = now.toISOString().slice(0, 10);
      filtered = trips.filter(t => (t.requested_at || '').slice(0, 10) === today);
    } else if (currentPeriod === 'week') {
      const weekAgo = new Date(now - 7 * 864e5).toISOString();
      filtered = trips.filter(t => (t.requested_at || '') >= weekAgo);
    } else if (currentPeriod === 'month') {
      const monthAgo = new Date(now - 30 * 864e5).toISOString();
      filtered = trips.filter(t => (t.requested_at || '') >= monthAgo);
    }

    const completed = filtered.filter(t => t.status === 'completed');
    const active    = filtered.filter(t => t.status === 'in_progress' || t.status === 'accepted');
    const revenue   = completed.reduce((sum, t) => sum + parseFloat(t.actual_fare || t.fare_estimate || 0), 0);

    setText('totalTrips',     filtered.length);
    setText('tripsSubtitle',  `${active.length} active · ${completed.length} completed`);
    setText('totalRevenue',   `₵${revenue.toFixed(2)}`);
    setText('revenueSubtitle',`₵${(revenue / (filtered.length || 1)).toFixed(2)} avg per trip`);
    setText('completedTrips', completed.length);
    setText('completedSubtitle', `${filtered.length > 0 ? Math.round(completed.length / filtered.length * 100) : 0}% completion rate`);

    // Hero pills
    setText('activeTripsCount', active.length);
    setText('todayRevenue', `₵${revenue.toFixed(2)}`);

    // Active badge
    const badge = $('activeTripsBadge');
    if (badge) { badge.textContent = active.length; badge.style.display = active.length > 0 ? 'inline-flex' : 'none'; }

    // Active rides icon — stop spin when data loaded
    const icon = $('activeRidesIcon');
    if (icon) { icon.classList.remove('fa-spin', 'fa-circle-notch'); icon.classList.add('fa-taxi'); }

    // QA badge
    setText('qaActiveBadge', `${active.length} active`);
    setText('qaTodayRevBadge', `₵${revenue.toFixed(2)} revenue`);

    renderRecentTrips(trips.slice(0, 12));

  } catch (e) {
    console.warn('Trips fetch error:', e.message);
    setText('totalTrips',    '—');
    setText('totalRevenue',  '₵—');
    setText('completedTrips','—');
    setText('activeTripsCount', '—');
    setText('todayRevenue', '₵—');
    renderRecentTripsError();
  }
}

function renderRecentTrips(trips) {
  const el = $('recentTripsList');
  if (!el) return;
  if (!trips || trips.length === 0) {
    el.innerHTML = `<div class="empty-data"><i class="fas fa-route"></i><span>No trips recorded yet</span></div>`;
    return;
  }
  el.innerHTML = trips.map(t => {
    const fare   = t.actual_fare || t.fare_estimate || 0;
    const date   = t.requested_at ? new Date(t.requested_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '—';
    const status = t.status || 'requested';
    return `
      <div class="trip-row">
        <div class="trip-id-badge">#${t.id}</div>
        <div class="trip-details">
          <div class="trip-route">${t.pickup_lat?.toFixed(3) || '?'},${t.pickup_lng?.toFixed(3) || '?'} → ${t.dest_lat?.toFixed(3) || '?'},${t.dest_lng?.toFixed(3) || '?'}</div>
          <div class="trip-time">${date}</div>
        </div>
        <div class="trip-fare">₵${parseFloat(fare).toFixed(2)}</div>
        <div class="trip-status-badge ${status}">${status.replace(/_/g,' ')}</div>
      </div>`;
  }).join('');
}

function renderRecentTripsError() {
  const el = $('recentTripsList');
  if (el) el.innerHTML = `<div class="empty-data"><i class="fas fa-wifi" style="color:var(--rose)"></i><span style="color:var(--rose)">Backend offline (port 8810)</span></div>`;
}

// ── Riders ──
async function loadRiderStats() {
  try {
    const [approvedRes, pendingRes] = await Promise.all([
      fetch(`${API}/admin/riders/approved`, { cache: 'no-store' }),
      fetch(`${API}/admin/riders/pending`, { cache: 'no-store' }),
    ]);
    const approved = approvedRes.ok ? await approvedRes.json() : [];
    const pending  = pendingRes.ok  ? await pendingRes.json()  : [];

    const onlineCount = approved.filter(r => r.is_available).length;
    setText('totalRiders',   approved.length);
    setText('ridersSubtitle', `${onlineCount} currently online`);
    setText('onlineDriversCount', onlineCount);
    setText('qaRidersBadge', `${approved.length} active`);

  } catch (e) {
    console.warn('Rider stats error:', e.message);
    setText('totalRiders', '—');
    setText('onlineDriversCount', '—');
  }
}

// ── Applications ──
async function loadApplicationStats() {
  try {
    const res = await fetch(`${API}/applications/stats/summary`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json();

    setText('pendingApplications', stats.pending || 0);
    setText('qaAppsBadge', `${stats.pending || 0} pending`);

    const badge = $('pendingAppsBadge');
    if (badge) {
      badge.textContent = stats.pending;
      badge.style.display = stats.pending > 0 ? 'inline-flex' : 'none';
    }
  } catch (e) {
    console.warn('Applications stats error:', e.message);
    // Fallback — fetch all and count
    try {
      const res2 = await fetch(`${API}/applications/`, { cache: 'no-store' });
      if (res2.ok) {
        const apps = await res2.json();
        const pending = apps.filter(a => a.status === 'pending_review').length;
        setText('pendingApplications', pending);
        setText('qaAppsBadge', `${pending} pending`);
      }
    } catch (_) {
      setText('pendingApplications', '—');
    }
  }
}

// ── Customers ──
async function loadCustomerStats() {
  try {
    const res = await fetch(`${API}/users/`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const users = await res.json();
    const passengers = users.filter(u => u.role_type === 'passenger').length;
    setText('totalCustomers', passengers);
    setText('customersSubtitle', `${passengers} registered accounts`);
  } catch (e) {
    console.warn('Customers error:', e.message);
    setText('totalCustomers', '—');
  }
}

// ── System Health ──
async function checkSystemHealth() {
  const endpoints = [
    { name: 'API Server',      icon: 'fa-server',      url: `${API}/trips/`,               label: 'Trips API' },
    { name: 'Database',        icon: 'fa-database',    url: `${API}/admin/`,               label: 'Admin API' },
    { name: 'Rider Mgmt',      icon: 'fa-motorcycle',  url: `${API}/admin/riders/approved`, label: 'Riders' },
    { name: 'Applications',    icon: 'fa-file-alt',    url: `${API}/applications/stats/summary`, label: 'Apps' },
  ];

  const grid = $('healthGrid');
  if (grid) grid.innerHTML = `<div class="panel-loading"><i class="fas fa-spinner fa-spin"></i> Checking…</div>`;

  let allOk = true;

  const results = await Promise.all(endpoints.map(async ep => {
    const start = Date.now();
    try {
      const res = await fetch(ep.url, { cache: 'no-store' });
      const ms = Date.now() - start;
      return { ...ep, ok: res.ok, ms, status: res.ok ? 'ok' : 'warn' };
    } catch (_) {
      return { ...ep, ok: false, ms: null, status: 'error' };
    }
  }));

  allOk = results.every(r => r.ok);

  if (grid) {
    grid.innerHTML = results.map(r => `
      <div class="health-item">
        <div class="health-icon ${r.status}"><i class="fas ${r.icon}"></i></div>
        <div class="health-info">
          <div class="health-name">${r.name}</div>
          <div class="health-desc">${r.ms != null ? `${r.ms}ms latency` : 'Connection failed'}</div>
        </div>
        <div class="health-status ${r.status}">${r.ok ? (r.ms < 300 ? 'Fast' : 'Online') : 'Offline'}</div>
      </div>`).join('');
  }

  // Topbar status
  const dot  = $('topbarDot');
  const text = $('topbarStatusText');
  if (dot)  dot.className  = `status-dot ${allOk ? '' : 'offline'}`;
  if (text) text.textContent = allOk ? 'All Systems Online' : 'Some Services Offline';

  // Footer stats
  const onlineCount = results.filter(r => r.ok).length;
  setText('statusSystem', `${onlineCount}/${results.length}`);
  setText('statusApi',  results[0]?.ok ? 'Online' : 'Offline');
  setText('statusDb',   results[1]?.ok ? 'Online' : 'Offline');
}

// ── Refresh button ──
const refreshBtn = $('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    const icon = refreshBtn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');
    await loadAllData();
    setTimeout(() => icon && icon.classList.remove('fa-spin'), 700);
    toast('info', 'Dashboard refreshed');
  });
}

const recheckBtn = $('recheckHealthBtn');
if (recheckBtn) recheckBtn.addEventListener('click', checkSystemHealth);

// ── Auto-refresh every 30s ──
setInterval(loadAllData, 30_000);

// ── Init ──
loadAllData();
