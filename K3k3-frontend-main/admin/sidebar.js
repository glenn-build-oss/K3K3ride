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
  const API_BASE   = 'http://localhost:8810';

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
      { href: 'payment-management.html', icon: 'fa-credit-card',label: 'Payments'           },
    ]},
    { group: 'SYSTEM', items: [
      { href: 'system-settings.html',    icon: 'fa-cog',        label: 'Settings'           },
    ]},
  ];

  function buildSidebar(sidebar) {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navHtml = NAV_LINKS.map(group => `
      <div class="nav-group">
        <div class="nav-group-label">${group.group}</div>
        <ul class="nav-list">
          ${group.items.map(item => {
            const isActive = currentPage === item.href;
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
            <div class="admin-name" id="shared-admin-name">Admin</div>
            <div class="admin-role">Super Admin</div>
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

  /* ── Admin name ── */
  function setAdminName() {
    try {
      const data = JSON.parse(localStorage.getItem('current_admin') || '{}');
      if (data.name) {
        ['shared-admin-name','heroAdminName','sidebarAdminName','heroAdminNameBanner','topbar-admin-name'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = data.name;
        });
        // topbar-admin-name spans
        document.querySelectorAll('.topbar-admin-name').forEach(el => el.textContent = data.name);
      }
    } catch (_) {}
  }

  /* ── Logout ── */
  function wireLogout() {
    const logoutFn = () => { localStorage.clear(); window.location.href = LOGOUT_URL; };
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

  /* ── Main init (DOMContentLoaded) ── */
  function init() {
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
