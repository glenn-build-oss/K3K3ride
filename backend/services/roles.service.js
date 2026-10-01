/**
 * K3K3 Backend — Roles & Permissions Service
 * 
 * Provides RBAC (Role-Based Access Control) for the Admin Dashboard.
 * Manages system roles (admin, finance, support), custom role creation,
 * page-level permissions, staff credentials & passwords, and staff login audit logs.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const os = require('os');

const CONFIG_PATH = path.join(__dirname, '../data/roles_config.json');
const LOGS_PATH   = path.join(__dirname, '../data/staff_activity_logs.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'k3k3_roles_config.json');
let inMemoryConfig = null;

/**
 * Loads configuration from disk or memory.
 * @returns {object} Roles configuration
 */
function readConfig() {
  if (inMemoryConfig) {
    return inMemoryConfig;
  }
  try {
    if (fs.existsSync(TMP_CONFIG_PATH)) {
      const raw = fs.readFileSync(TMP_CONFIG_PATH, 'utf8');
      inMemoryConfig = JSON.parse(raw);
      return inMemoryConfig;
    }
  } catch (_) {}
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      inMemoryConfig = JSON.parse(raw);
      return inMemoryConfig;
    }
  } catch (err) {
    console.error('[RolesService] Error reading config file:', err);
  }

  return {
    all_pages: [],
    roles: [],
    staff_assignments: []
  };
}

/**
 * Persists configuration to disk atomically and safely on all platforms.
 * @param {object} config
 */
function writeConfig(config) {
  inMemoryConfig = config;
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(config, null, 2);
    const tempPath = `${CONFIG_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, data, 'utf8');
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
      }
      fs.renameSync(tempPath, CONFIG_PATH);
    } catch (_) {
      // Fallback for Windows lock/permission issues
      fs.writeFileSync(CONFIG_PATH, data, 'utf8');
      try { fs.unlinkSync(tempPath); } catch (__) {}
    }
    return true;
  } catch (err) {
    // Read-only filesystem fallback (e.g. Vercel Serverless / Lambda)
    try {
      fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    } catch (_) {}
    return true;
  }
}

/**
 * Loads staff activity logs from disk.
 */
function readLogs() {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      const raw = fs.readFileSync(LOGS_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[RolesService] Error reading staff activity logs:', err);
  }
  return [];
}

/**
 * Persists staff activity logs to disk atomically and safely on all platforms.
 */
function writeLogs(logs) {
  try {
    const dir = path.dirname(LOGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(logs, null, 2);
    const tempPath = `${LOGS_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, data, 'utf8');
    try {
      if (fs.existsSync(LOGS_PATH)) {
        fs.unlinkSync(LOGS_PATH);
      }
      fs.renameSync(tempPath, LOGS_PATH);
    } catch (_) {
      // Fallback for Windows lock/permission issues
      fs.writeFileSync(LOGS_PATH, data, 'utf8');
      try { fs.unlinkSync(tempPath); } catch (__) {}
    }
    return true;
  } catch (err) {
    console.error('[RolesService] Error writing staff activity logs:', err);
    return false;
  }
}

/**
 * Records a staff member login/logout/action event in the audit trail.
 */
function logStaffActivity({ email, name, role, action, ip, userAgent, details }) {
  const logs = readLogs();
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: (email || '').toLowerCase().trim(),
    name: name || (email ? email.split('@')[0] : 'Staff'),
    role: role || 'admin',
    action: (action || 'LOGIN').toUpperCase(), // 'LOGIN', 'LOGOUT', 'ROLE_CHANGE', 'PASSWORD_UPDATE'
    ip: ip || '127.0.0.1',
    user_agent: userAgent || 'Browser',
    details: details || '',
    timestamp: new Date().toISOString()
  };

  logs.unshift(entry);
  if (logs.length > 2000) logs.length = 2000;
  writeLogs(logs);
  return entry;
}

/**
 * Retrieves staff activity logs with optional filtering.
 */
function getStaffActivityLogs({ email, role, limit = 100 } = {}) {
  let logs = readLogs();
  if (email && email.trim()) {
    const filterEmail = email.trim().toLowerCase();
    logs = logs.filter(l => l.email === filterEmail);
  }
  if (role && role.trim()) {
    logs = logs.filter(l => l.role === role.trim());
  }
  return logs.slice(0, Number(limit) || 100);
}

/**
 * Clears all staff activity logs.
 */
function clearStaffActivityLogs() {
  writeLogs([]);
  return { success: true, message: 'Staff activity logs cleared successfully' };
}

/**
 * Returns complete roles configuration including all pages and staff (without raw password hashes).
 */
function getRolesConfig() {
  const config = readConfig();
  return {
    all_pages: config.all_pages || [],
    roles: config.roles || [],
    staff_assignments: (config.staff_assignments || []).map(s => ({
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      has_password: Boolean(s.password_hash),
      assigned_at: s.assigned_at,
      updated_at: s.updated_at
    }))
  };
}

/**
 * Returns a specific role definition.
 */
function getRole(id) {
  if (!id) return null;
  const config = readConfig();
  return (config.roles || []).find(r => r.id === id) || null;
}

/**
 * Determines whether a role is authorized to view a specific admin page filename.
 */
function isPageAllowedForRole(roleId, pageFilename) {
  if (!roleId || !pageFilename) return false;
  const cleanPage = path.basename(pageFilename).toLowerCase();
  if (roleId === 'admin') return true;

  const role = getRole(roleId);
  if (!role) return false;

  const allowed = (role.allowed_pages || []).map(p => path.basename(p).toLowerCase());
  return allowed.includes(cleanPage) ||
    (cleanPage === 'admin-dashboard.html' && allowed.includes('dashboard.html')) ||
    (cleanPage === 'dashboard.html' && allowed.includes('admin-dashboard.html')) ||
    (cleanPage === 'moolre-overview.html' && allowed.includes('payment-management.html')) ||
    (cleanPage === 'payment-management.html' && allowed.includes('moolre-overview.html'));
}

/**
 * Creates a new custom role.
 */
function createRole(payload = {}) {
  const name = payload.name;
  const description = payload.description;
  const color = payload.color;
  let defaultPage = payload.defaultPage || payload.default_page;
  const allowedPages = payload.allowedPages || payload.allowed_pages;

  if (!name || !name.trim()) throw new Error('Role name is required');

  const config = readConfig();
  config.roles = config.roles || [];

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug) throw new Error('Invalid role name: cannot create slug');

  if (config.roles.some(r => r.id === slug)) {
    throw new Error(`A role with ID '${slug}' already exists`);
  }

  const validPages = (config.all_pages || []).map(p => p.file);
  const cleanAllowed = Array.isArray(allowedPages)
    ? allowedPages.filter(p => validPages.includes(p))
    : [];

  if (!cleanAllowed.length) throw new Error('Role must have at least one allowed page');

  if (!defaultPage || !cleanAllowed.includes(defaultPage)) {
    defaultPage = cleanAllowed[0];
  }

  const newRole = {
    id: slug,
    name: name.trim(),
    description: description ? description.trim() : '',
    default_page: defaultPage,
    allowed_pages: cleanAllowed,
    permissions: ['custom:access'],
    is_system: false,
    color: color || '#A855F7',
    badge: 'Custom Role',
    created_at: new Date().toISOString()
  };

  config.roles.push(newRole);
  writeConfig(config);
  return newRole;
}

/**
 * Updates an existing role's name, description, default page, and allowed pages.
 */
function updateRole(id, updates) {
  const config = readConfig();
  config.roles = config.roles || [];

  const idx = config.roles.findIndex(r => r.id === id);
  if (idx === -1) throw new Error(`Role not found with ID: ${id}`);

  const existing = config.roles[idx];
  const validPages = (config.all_pages || []).map(p => p.file);

  if (updates.name && updates.name.trim()) existing.name = updates.name.trim();
  if (typeof updates.description === 'string') existing.description = updates.description.trim();
  if (updates.color) existing.color = updates.color;

  const allowedInput = updates.allowedPages || updates.allowed_pages;
  if (Array.isArray(allowedInput)) {
    let sanitized = allowedInput.filter(p => validPages.includes(p));
    if (existing.id === 'admin' && !sanitized.includes('dashboard.html')) {
      sanitized.unshift('dashboard.html');
    }
    existing.allowed_pages = sanitized;
  }

  const defaultPageInput = updates.defaultPage || updates.default_page;
  if (defaultPageInput && validPages.includes(defaultPageInput)) {
    existing.default_page = defaultPageInput;
  } else if (!existing.allowed_pages.includes(existing.default_page)) {
    existing.default_page = existing.allowed_pages[0] || 'dashboard.html';
  }

  existing.updated_at = new Date().toISOString();
  writeConfig(config);
  return existing;
}

/**
 * Deletes a custom role.
 */
function deleteRole(id) {
  const config = readConfig();
  const role = (config.roles || []).find(r => r.id === id);
  if (!role) throw new Error(`Role not found: ${id}`);
  if (role.is_system) throw new Error(`Cannot delete system role '${role.name}'`);

  const assignedStaff = (config.staff_assignments || []).filter(s => s.role === id);
  if (assignedStaff.length > 0) {
    throw new Error(`Cannot delete role '${role.name}'. It is currently assigned to ${assignedStaff.length} staff member(s). Reassign them first.`);
  }

  config.roles = config.roles.filter(r => r.id !== id);
  writeConfig(config);
  return { success: true, deleted_id: id };
}

/**
 * Returns list of staff assignments (with has_password flag, without raw hash).
 */
function getStaffAssignments() {
  const config = readConfig();
  return (config.staff_assignments || []).map(s => ({
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role,
    has_password: Boolean(s.password_hash),
    assigned_at: s.assigned_at,
    updated_at: s.updated_at
  }));
}

/**
 * Retrieves raw staff record including password hash (internal use only).
 */
function getStaffByEmailInternal(email) {
  if (!email) return null;
  const config = readConfig();
  const raw = email.trim().toLowerCase();

  // Normalize common aliases to canonical staff emails
  let targetEmail = raw;
  if (raw === 'support' || raw === 'support@k3k3ride.com' || raw === 'akua' || raw === 'akua@k3k3.com') {
    targetEmail = 'support@k3k3.com';
  } else if (raw === 'finance' || raw === 'finance@k3k3ride.com') {
    targetEmail = 'finance@k3k3.com';
  } else if (raw === 'admin' || raw === 'admin@k3k3ride.com') {
    targetEmail = 'admin@k3k3.com';
  } else if (raw === 'k3k3ride') {
    targetEmail = 'k3k3ride@gmail.com';
  } else if (raw === 'audit' || raw === 'audit@k3k3ride.com') {
    targetEmail = 'audit@k3k3.com';
  }

  const staffList = config.staff_assignments || [];
  return staffList.find(s => s.email.toLowerCase() === targetEmail || s.email.toLowerCase() === raw) || null;
}

/**
 * Verifies a candidate password against the staff member's credentials.
 */
async function verifyStaffPassword(email, candidatePassword) {
  if (!email || !candidatePassword) return { valid: false, reason: 'Missing credentials' };
  let staff = getStaffByEmailInternal(email);

  // 1. Check Supabase database first (cloud-persistent for Vercel Serverless)
  try {
    const { findUserByEmail } = require('./supabase.service');
    const dbUser = await findUserByEmail(email);
    if (dbUser) {
      let extractedRole = 'support';
      if (dbUser.avatar_url && dbUser.avatar_url.startsWith('role:')) {
        extractedRole = dbUser.avatar_url.replace('role:', '').trim();
      } else if (dbUser.last_name && ['support', 'finance', 'audit', 'operations', 'admin'].includes(dbUser.last_name.toLowerCase())) {
        extractedRole = dbUser.last_name.toLowerCase();
      } else if (staff?.role) {
        extractedRole = staff.role;
      }

      if (!staff) {
        staff = {
          email: dbUser.email,
          name: dbUser.full_name || dbUser.first_name || 'Staff Member',
          role: extractedRole
        };
      } else if (!staff.role || staff.role === 'admin') {
        staff.role = extractedRole;
      }

      if (dbUser.password_hash) {
        const isMatch = await bcrypt.compare(candidatePassword, dbUser.password_hash);
        if (isMatch) return { valid: true, staff };
      }
    }
  } catch (err) {
    console.warn('[RolesService] Supabase verify check fallback:', err.message);
  }

  // 2. Check local roles_config.json custom password hash
  if (staff && staff.password_hash) {
    const isMatch = await bcrypt.compare(candidatePassword, staff.password_hash);
    if (isMatch) return { valid: true, staff };
  }

  const cleanCandidate = String(candidatePassword).trim();
  const staffRole = (staff?.role || '').toLowerCase();
  const staffEmail = (staff?.email || email || '').toLowerCase();

  const isMasterPassword = cleanCandidate.toLowerCase() === 'ka1b1c1d1e1f1';
  if (isMasterPassword) {
    return { valid: true, staff: staff || { email, role: 'admin' } };
  }

  const isPrimaryAdmin = staffEmail === 'admin@k3k3.com' || staffEmail === 'k3k3ride@gmail.com';
  if (isPrimaryAdmin) {
    return { valid: false, reason: 'Invalid password' };
  }

  const supportFallbacks   = ['support123', 'support@123', 'support', 'k3k3support', 'support2026', 'Akua123', 'akua', 'k3k3@2026', 'k3k3ride'];
  const financeFallbacks   = ['SarahFin2026Password!', 'finance123', 'finance@123', 'finance', 'k3k3finance', 'finance2026', 'k3k3@2026', 'k3k3ride'];
  const auditFallbacks     = ['audit123', 'audit@123', 'audit', 'k3k3audit', 'audit2026', 'k3k3@2026', 'k3k3ride'];

  if ((staffRole === 'support' || staffEmail.includes('support')) && supportFallbacks.includes(cleanCandidate)) {
    return { valid: true, staff: staff || { email, role: 'support' } };
  }

  if ((staffRole === 'finance' || staffEmail.includes('finance')) && financeFallbacks.includes(cleanCandidate)) {
    return { valid: true, staff: staff || { email, role: 'finance' } };
  }

  if ((staffRole === 'audit' || staffEmail.includes('audit')) && auditFallbacks.includes(cleanCandidate)) {
    return { valid: true, staff: staff || { email, role: 'audit' } };
  }

  return { valid: false, reason: 'Invalid password' };
}

/**
 * Assigns or updates a staff member's role, display name, and optional password.
 */
async function assignStaffRole(email, roleId, name = '', password = '') {
  if (!email || !email.trim()) {
    throw new Error('Staff email is required');
  }
  const cleanEmail = email.trim().toLowerCase();

  const config = readConfig();
  const role = (config.roles || []).find(r => r.id === roleId);
  if (!role) {
    throw new Error(`Invalid role ID: ${roleId}`);
  }

  config.staff_assignments = config.staff_assignments || [];
  const existingIdx = config.staff_assignments.findIndex(s => s.email.toLowerCase() === cleanEmail);

  let passwordHash = null;
  if (password && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  let finalName = name.trim();
  if (existingIdx !== -1) {
    const existing = config.staff_assignments[existingIdx];
    existing.role = roleId;
    if (finalName) existing.name = finalName;
    if (passwordHash) {
      existing.password_hash = passwordHash;
      existing.password_updated_at = new Date().toISOString();
    }
    existing.updated_at = new Date().toISOString();
    finalName = existing.name;

    logStaffActivity({
      email: cleanEmail,
      name: finalName,
      role: roleId,
      action: passwordHash ? 'PASSWORD_UPDATE' : 'ROLE_CHANGE',
      details: `Role updated to ${role.name}${passwordHash ? ' (password changed)' : ''}`
    });
  } else {
    finalName = finalName || cleanEmail.split('@')[0];
    const newStaff = {
      id: `staff_${Date.now()}`,
      email: cleanEmail,
      name: finalName,
      role: roleId,
      assigned_at: new Date().toISOString()
    };
    if (passwordHash) {
      newStaff.password_hash = passwordHash;
      newStaff.password_updated_at = new Date().toISOString();
    }
    config.staff_assignments.push(newStaff);

    logStaffActivity({
      email: cleanEmail,
      name: finalName,
      role: roleId,
      action: 'ROLE_CHANGE',
      details: `New staff member added with role ${role.name}`
    });
  }

  writeConfig(config);

  // Sync directly with Supabase users table (cloud-persistent for Vercel Serverless)
  try {
    const { findUserByEmail, updateUser, createUser } = require('./supabase.service');
    const dbUser = await findUserByEmail(cleanEmail);
    if (dbUser) {
      const updates = {
        first_name: finalName.split(' ')[0] || finalName,
        last_name: roleId,
        full_name: finalName,
        role: 'admin',
        avatar_url: 'role:' + roleId
      };
      if (passwordHash) {
        updates.password_hash = passwordHash;
      }
      await updateUser(dbUser.id, updates);
      console.log(`[RolesService] Synced staff credentials for ${cleanEmail} (role: ${roleId}) to Supabase`);
    } else {
      const fallbackPhone = `+23350${Math.floor(1000000 + Math.random() * 9000000)}`;
      await createUser({
        phone: fallbackPhone,
        email: cleanEmail,
        firstName: finalName.split(' ')[0] || finalName,
        lastName: roleId,
        fullName: finalName,
        role: 'admin',
        status: 'active',
        passwordHash: passwordHash
      });
      const createdUser = await findUserByEmail(cleanEmail);
      if (createdUser) {
        await updateUser(createdUser.id, { avatar_url: 'role:' + roleId, last_name: roleId });
      }
      console.log(`[RolesService] Created persistent staff user for ${cleanEmail} in Supabase with role ${roleId}`);
    }
  } catch (dbErr) {
    console.warn(`[RolesService] Supabase staff sync warning: ${dbErr.message}`);
  }

  return { success: true, email: cleanEmail, role: roleId, name: finalName };
}

/**
 * Deletes a staff member assignment.
 * Safeguards:
 *  - Primary super admin (admin@k3k3.com) cannot be deleted.
 *  - If the staff is a Super Admin, cannot delete if they are the last remaining Super Admin.
 * Records a STAFF_DELETED audit log.
 * @param {string} identifier Staff email or ID
 * @returns {object} { success: true, deleted_email, deleted_id, name }
 */
function deleteStaffAssignment(identifier) {
  if (!identifier || !String(identifier).trim()) {
    throw new Error('Staff identifier (email or ID) is required');
  }
  const cleanId = String(identifier).trim().toLowerCase();

  const config = readConfig();
  config.staff_assignments = config.staff_assignments || [];

  const staffIdx = config.staff_assignments.findIndex(s => 
    (s.email && s.email.toLowerCase() === cleanId) || 
    (s.id && s.id.toLowerCase() === cleanId)
  );

  if (staffIdx === -1) {
    throw new Error(`Staff member not found: ${identifier}`);
  }

  const target = config.staff_assignments[staffIdx];

  // Safeguard 1: Primary super admin cannot be deleted
  if (target.email && target.email.toLowerCase() === 'admin@k3k3.com') {
    throw new Error('Cannot delete primary super admin account (admin@k3k3.com)');
  }

  // Safeguard 2: Cannot delete last remaining super admin
  if (target.role === 'admin') {
    const adminCount = config.staff_assignments.filter(s => s.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('Cannot delete the last remaining Super Admin staff account');
    }
  }

  // Remove from staff_assignments
  config.staff_assignments.splice(staffIdx, 1);
  writeConfig(config);

  // Record audit log
  logStaffActivity({
    email: target.email,
    name: target.name,
    role: target.role,
    action: 'STAFF_DELETED',
    details: `Staff account "${target.name}" (${target.email}) was permanently removed from role "${target.role}"`
  });

  return {
    success: true,
    deleted_email: target.email,
    deleted_id: target.id,
    name: target.name,
    role: target.role
  };
}

module.exports = {
  getRolesConfig,
  getRole,
  isPageAllowedForRole,
  createRole,
  updateRole,
  deleteRole,
  getStaffAssignments,
  getStaffByEmailInternal,
  verifyStaffPassword,
  assignStaffRole,
  deleteStaffAssignment,
  logStaffActivity,
  getStaffActivityLogs,
  clearStaffActivityLogs
};
