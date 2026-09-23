/**
 * K3K3 Admin — Shared Sidebar Injector  v=20260615c
 * Drop this script at the bottom of any admin page and it:
 *  1. Injects the standard sidebar HTML if #k3k3Sidebar exists
 *  2. Starts the live clock
 *  3. Wires mobile toggle + logout
 *  4. Marks the active nav item based on current page filename
 */
(function () {
  'use strict';

  /* ── Config ── */
  const LOGOUT_URL = 'adminlogin.html';
  const API_BASE   = (window.location.port !== '8810' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:8810'
    : '';

  /* ── Current Session & RBAC ── */
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('current_admin') || '{}');
    } catch (_) {
      return {};
    }
  }

  function checkRouteGuard(currentPage, user) {
    if (!user || !user.role) return;
    if (user.role === 'admin') return; // Super Admin has universal access

    const allowed = user.allowedPages || user.allowed_pages;
    if (Array.isArray(allowed) && allowed.length > 0) {
      const pageFile = (currentPage || '').toLowerCase();
      if (!pageFile || pageFile === 'adminlogin.html') return;

      const isAllowed = allowed.some(p => {
        const lp = p.toLowerCase();
        return lp === pageFile ||
          (pageFile === 'admin-dashboard.html' && lp === 'dashboard.html') ||
          (pageFile === 'dashboard.html' && lp === 'admin-dashboard.html') ||
          (pageFile === 'moolre-overview.html' && lp === 'payment-management.html') ||
          (pageFile === 'payment-management.html' && lp === 'moolre-overview.html');
      });
      if (!isAllowed) {
        console.warn(`[K3K3 RBAC] Access denied for role "${user.role}" on page: ${currentPage}`);
        const fallback = user.defaultPage || user.default_page || allowed[0] || 'dashboard.html';
        if (fallback.toLowerCase() !== pageFile) {
          alert(`Access Restricted\n\nYour assigned role (${user.roleName || user.role}) does not have permission to access this page.\nRedirecting to your workspace...`);
          window.location.replace(fallback);
        }
      }
    }
  }

  /* ── Sidebar HTML ── */
  const NAV_LINKS = [
    { group: 'MAIN', items: [
      { href: 'dashboard.html',          icon: 'fa-tachometer-alt', label: 'Dashboard'        },
      { href: 'analytics.html',          icon: 'fa-chart-pie',      label: 'Analytics'        },
      { href: 'ride-monitoring.html',    icon: 'fa-map-marked-alt', label: 'Live Tracking'    },
      { href: 'trips.html',              icon: 'fa-route',          label: 'Trips'             },
      { href: 'customers.html',          icon: 'fa-users',          label: 'Customers'        },
    ]},
    { group: 'OPERATIONS', items: [
      { href: 'rider-applications.html', icon: 'fa-user-plus',  label: 'Rider Applications', badgeId: 'sidebar-pending-badge' },
      { href: 'rider-management.html',   icon: 'fa-id-card',    label: 'Rider Management'   },
      { href: 'live-riders.html',        icon: 'fa-motorcycle', label: 'Live Riders'        },
      { href: 'pricing-cms.html',        icon: 'fa-tags',       label: 'Routes & Pricing CMS' },
      { href: 'payment-management.html', icon: 'fa-credit-card',label: 'Payments'           },
      { href: 'moolre-overview.html',    icon: 'fa-bolt',       label: 'Moolre Overview'    },
      { href: 'roles-management.html',   icon: 'fa-user-shield',label: 'Roles & Permissions'},
    ]},
    { group: 'SYSTEM', items: [
      { href: 'system-settings.html',    icon: 'fa-cog',        label: 'Settings'           },
    ]},
  ];

  function buildSidebar(sidebar) {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const user = getCurrentUser();
    const allowed = (user.role && user.role !== 'admin' && (user.allowedPages || user.allowed_pages))
      ? (user.allowedPages || user.allowed_pages)
      : null;

    const visibleGroups = NAV_LINKS.map(group => {
      const items = allowed
        ? group.items.filter(item => allowed.includes(item.href))
        : group.items;
      return { group: group.group, items };
    }).filter(group => group.items.length > 0);

    const navHtml = visibleGroups.map(group => `
      <div class="nav-group">
        <div class="nav-group-label">${group.group}</div>
        <ul class="nav-list">
          ${group.items.map(item => {
            const isActive = (currentPage === item.href) ||
              (item.href === 'dashboard.html' && (currentPage === 'admin-dashboard.html' || currentPage === 'dashboard.html')) ||
              (item.href === 'payment-management.html' && (currentPage === 'payment-management.html' || currentPage === 'moolre-overview.html'));
            const badge = item.badgeId
              ? `<span class="nav-badge pending-badge" id="${item.badgeId}" style="display:none">0</span>`
              : '';
            return `<li class="nav-item${isActive ? ' active' : ''}">
              <a href="${item.href}" class="nav-link">
                <span class="nav-icon"><i class="fas ${item.icon}"></i></span>
                <span class="nav-text">${item.label}</span>
                ${badge}
              </a>
            </li>`;
          }).join('')}
        </ul>
      </div>`).join('');

    const roleDisplayName = user.roleName || (user.role === 'admin' ? 'Super Admin' : (user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Super Admin'));

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-logo">
            <img src="../assets/k3k3.png" alt="K3K3 Logo"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="brand-logo-fallback" style="display:none">K3</div>
          </div>
          <div class="brand-text">
            <span class="brand-name">K3K3</span>
            <span class="brand-tag">Enterprise Admin</span>
          </div>
        </div>
        <div class="sidebar-clock">
          <div class="clock-date" id="shared-date">—</div>
          <div class="clock-time">
            <span id="shared-hours">00</span><span class="colon">:</span>
            <span id="shared-minutes">00</span><span class="colon">:</span>
            <span id="shared-seconds">00</span>
          </div>
          <div class="clock-label">Local Time</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="admin-profile-card">
          <div class="admin-avatar-wrap">
            <div class="admin-avatar"><i class="fas fa-user-shield"></i></div>
            <span class="online-dot"></span>
          </div>
          <div class="admin-info">
            <div class="admin-name" id="shared-admin-name">${user.name || 'Admin'}</div>
            <div class="admin-role" id="shared-admin-role">${roleDisplayName}</div>
          </div>
        </div>
        <button class="sidebar-logout-btn" id="shared-logout-btn">
          <i class="fas fa-sign-out-alt"></i><span>Logout</span>
        </button>
      </div>`;
  }

  /* ── Clock ── */
  function startClock() {
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const now = new Date();
      const ids = [
        ['shared-hours',   pad(now.getHours())],
        ['shared-minutes', pad(now.getMinutes())],
        ['shared-seconds', pad(now.getSeconds())],
        // also support old IDs on pages that already have their own clocks
        ['hours',   pad(now.getHours())],
        ['minutes', pad(now.getMinutes())],
        ['seconds', pad(now.getSeconds())],
      ];
      ids.forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });

      const dateStr = now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
      ['shared-date', 'dateValue'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = dateStr; });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ── Mobile sidebar ── */
  function wireMobileToggle() {
    const sidebar = document.getElementById('k3k3Sidebar');
    if (!sidebar) return;

    // Ensure overlay exists
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    const toggleBtn = document.getElementById('menuToggle') || document.getElementById('sidebarToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
        overlay.classList.toggle('overlay-visible');
      });
    }
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-open');
      overlay.classList.remove('overlay-visible');
    });
  }

  /* ── Admin name & role title sync ── */
  function setAdminName() {
    try {
      const data = JSON.parse(localStorage.getItem('current_admin') || '{}');
      const name = data.name || (data.role === 'admin' ? 'K3K3 Admin' : 'Staff');
      ['shared-admin-name','heroAdminName','sidebarAdminName','heroAdminNameBanner','topbar-admin-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = name;
      });
      document.querySelectorAll('.topbar-admin-name').forEach(el => el.textContent = name);

      const roleDisplayName = data.roleName || (data.role === 'admin' ? 'Super Admin' : (data.role ? (data.role.charAt(0).toUpperCase() + data.role.slice(1)) : 'Super Admin'));
      ['shared-admin-role','sidebarAdminRole','topbar-admin-role'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = roleDisplayName;
      });
      document.querySelectorAll('.topbar-admin-role').forEach(el => el.textContent = roleDisplayName);
    } catch (_) {}
  }
  window.k3k3SetAdminName = setAdminName;

  /* ── Logout with audit logging ── */
  function wireLogout() {
    const logoutFn = () => {
      try {
        const user = getCurrentUser();
        if (user && user.email) {
          fetch(`${API_BASE}/api/auth/admin/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
            keepalive: true
          }).catch(() => {});
        }
      } catch (_) {}
      localStorage.clear();
      window.location.href = LOGOUT_URL;
    };
    ['shared-logout-btn','sidebarLogoutBtn','topbarLogoutBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', logoutFn);
    });
    // any element with data-logout
    document.querySelectorAll('[data-logout]').forEach(el => el.addEventListener('click', logoutFn));
  }

  /* ── Pending badge (fetch from API) ── */
  async function loadPendingBadge() {
    try {
      const res = await fetch(`${API_BASE}/applications/stats/summary`, { cache: 'no-store' });
      if (!res.ok) return;
      const stats = await res.json();
      const count = stats.pending || 0;
      const badge = document.getElementById('sidebar-pending-badge');
      if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    } catch (_) {}
  }

  /* ── Sidebar Styles ── */
  function injectSidebarStyles() {
    if (document.getElementById('k3k3-sidebar-styles')) return;
    const style = document.createElement('style');
    style.id = 'k3k3-sidebar-styles';
    style.textContent = `
      .sidebar-header { padding: 20px 18px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.08)); flex-shrink: 0; }
      .sidebar-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
      .brand-logo { width: 42px; height: 42px; border-radius: 10px; background: rgba(255,214,10,0.1); border: 1px solid rgba(255,214,10,0.25); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
      .brand-logo img { width: 32px; height: 32px; object-fit: contain; }
      .brand-logo-fallback { font-weight: 900; font-size: 1.1rem; color: #FFD60A; }
      .brand-text { display: flex; flex-direction: column; }
      .brand-name { font-weight: 900; font-size: 1.15rem; color: #fff; letter-spacing: -0.02em; line-height: 1.1; }
      .brand-tag { font-size: 0.68rem; font-weight: 600; color: #FFD60A; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
      .sidebar-clock { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; text-align: center; }
      .clock-date { font-size: 0.7rem; color: rgba(255,255,255,0.6); font-weight: 500; }
      .clock-time { font-family: 'Inter', monospace; font-size: 1.05rem; font-weight: 700; color: #fff; letter-spacing: 1px; margin: 2px 0; }
      .clock-time .colon { color: #FFD60A; opacity: 0.8; }
      .clock-label { font-size: 0.62rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.05em; }
      .sidebar-nav { flex: 1; overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 18px; }
      .nav-group-label { font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.08em; padding: 0 10px 6px; }
      .nav-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
      .nav-item .nav-link { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 8px; color: rgba(255,255,255,0.6); text-decoration: none; font-size: 0.82rem; font-weight: 500; transition: all 0.15s; }
      .nav-item:hover .nav-link { background: rgba(255,255,255,0.05); color: #fff; }
      .nav-item.active .nav-link { background: rgba(255,214,10,0.12); color: #FFD60A; font-weight: 600; border-left: 3px solid #FFD60A; }
      .nav-icon { width: 18px; text-align: center; font-size: 0.9rem; color: inherit; }
      .nav-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .nav-badge { background: #EF4444; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 999px; }
      .sidebar-footer { padding: 14px 16px; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); background: var(--bg-2, #111318); display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
      .admin-profile-card { display: flex; align-items: center; gap: 10px; }
      .admin-avatar-wrap { position: relative; }
      .admin-avatar { width: 34px; height: 34px; border-radius: 50%; background: #181b22; border: 1px solid rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; color: #FFD60A; font-size: 0.85rem; }
      .online-dot { position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%; background: #10B981; border: 2px solid #111318; }
      .admin-info { flex: 1; overflow: hidden; }
      .admin-name { font-size: 0.8rem; font-weight: 600; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .admin-role { font-size: 0.68rem; color: rgba(255,255,255,0.35); }
      .sidebar-logout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.08); color: #F87171; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.18s; }
      .sidebar-logout-btn:hover { background: rgba(239,68,68,0.2); color: #fff; }
    `;
    document.head.appendChild(style);
  }

  /* ── Main init (DOMContentLoaded) ── */
  function init() {
    injectSidebarStyles();
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    checkRouteGuard(currentPage, getCurrentUser());
    const sidebar = document.getElementById('k3k3Sidebar');
    if (sidebar && !sidebar.dataset.built) {
      buildSidebar(sidebar);
      sidebar.dataset.built = '1';
    }
    startClock();
    wireMobileToggle();
    setAdminName();
    wireLogout();
    loadPendingBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
