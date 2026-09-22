/**
 * K3K3 Backend — Roles & Permissions Service
 * 
 * Provides RBAC (Role-Based Access Control) for the Admin Dashboard.
 * Manages system roles (admin, finance, support), custom role creation,
 * page-level permissions, and staff member role assignments.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/roles_config.json');

/**
 * Loads configuration from disk.
 * @returns {object} Roles configuration
 */
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
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
 * Persists configuration to disk atomically.
 * @param {object} config
 */
function writeConfig(config) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${CONFIG_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tempPath, CONFIG_PATH);
    return true;
  } catch (err) {
    console.error('[RolesService] Error writing config file:', err);
    return false;
  }
}

/**
 * Returns complete roles configuration including all pages and staff.
 */
function getRolesConfig() {
  return readConfig();
}

/**
 * Retrieves a single role by ID.
 * @param {string} id
 */
function getRole(id) {
  const config = readConfig();
  return (config.roles || []).find(r => r.id === id) || null;
}

/**
 * Checks if a specific admin page is permitted for a role.
 * @param {string} roleId
 * @param {string} pageFilename
 * @returns {boolean}
 */
function isPageAllowedForRole(roleId, pageFilename) {
  if (!roleId || !pageFilename) return false;
  const config = readConfig();
  const cleanPage = pageFilename.split('/').pop().split('?')[0].trim();

  // Super admin has access to everything
  if (roleId === 'admin') return true;

  const role = (config.roles || []).find(r => r.id === roleId);
  if (!role) return false;

  return Array.isArray(role.allowed_pages) && role.allowed_pages.includes(cleanPage);
}

/**
 * Creates a new custom role.
 * @param {object} param0
 */
function createRole({ name, description, default_page, allowed_pages, color }) {
  if (!name || !name.trim()) {
    throw new Error('Role name is required');
  }

  const config = readConfig();
  config.roles = config.roles || [];

  // Generate unique slug
  let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug) slug = `role_${Date.now()}`;

  // Ensure unique ID
  if (config.roles.some(r => r.id === slug)) {
    slug = `${slug}_${Date.now().toString().slice(-4)}`;
  }

  const validPages = (config.all_pages || []).map(p => p.file);
  const cleanAllowed = Array.isArray(allowed_pages)
    ? allowed_pages.filter(p => validPages.includes(p))
    : [];

  const defaultPage = (default_page && validPages.includes(default_page))
    ? default_page
    : (cleanAllowed[0] || 'dashboard.html');

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
 * @param {string} id
 * @param {object} updates
 */
function updateRole(id, updates) {
  const config = readConfig();
  config.roles = config.roles || [];

  const idx = config.roles.findIndex(r => r.id === id);
  if (idx === -1) {
    throw new Error(`Role not found with ID: ${id}`);
  }

  const existing = config.roles[idx];
  const validPages = (config.all_pages || []).map(p => p.file);

  if (updates.name && updates.name.trim()) {
    existing.name = updates.name.trim();
  }
  if (typeof updates.description === 'string') {
    existing.description = updates.description.trim();
  }
  if (updates.color) {
    existing.color = updates.color;
  }

  if (Array.isArray(updates.allowed_pages)) {
    // If super admin, ensure dashboard is always included
    let sanitized = updates.allowed_pages.filter(p => validPages.includes(p));
    if (existing.id === 'admin' && !sanitized.includes('dashboard.html')) {
      sanitized.unshift('dashboard.html');
    }
    existing.allowed_pages = sanitized;
  }

  if (updates.default_page && validPages.includes(updates.default_page)) {
    existing.default_page = updates.default_page;
  } else if (!existing.allowed_pages.includes(existing.default_page)) {
    existing.default_page = existing.allowed_pages[0] || 'dashboard.html';
  }

  existing.updated_at = new Date().toISOString();
  config.roles[idx] = existing;
  writeConfig(config);

  return existing;
}

/**
 * Deletes a custom role. Cannot delete system roles (admin, finance, support).
 * @param {string} id
 */
function deleteRole(id) {
  const config = readConfig();
  config.roles = config.roles || [];

  const role = config.roles.find(r => r.id === id);
  if (!role) {
    throw new Error(`Role not found with ID: ${id}`);
  }

  if (role.is_system) {
    throw new Error(`Cannot delete system role '${role.name}'`);
  }

  // Check if any staff are assigned to this role
  const assignedStaff = (config.staff_assignments || []).filter(s => s.role === id);
  if (assignedStaff.length > 0) {
    throw new Error(`Cannot delete role '${role.name}'. It is currently assigned to ${assignedStaff.length} staff member(s). Reassign them first.`);
  }

  config.roles = config.roles.filter(r => r.id !== id);
  writeConfig(config);

  return { success: true, deleted_id: id };
}

/**
 * Returns list of staff assignments.
 */
function getStaffAssignments() {
  const config = readConfig();
  return config.staff_assignments || [];
}

/**
 * Assigns or updates a staff member's role.
 * @param {string} email
 * @param {string} roleId
 * @param {string} [name]
 */
function assignStaffRole(email, roleId, name = '') {
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

  if (existingIdx !== -1) {
    config.staff_assignments[existingIdx].role = roleId;
    if (name) config.staff_assignments[existingIdx].name = name.trim();
    config.staff_assignments[existingIdx].updated_at = new Date().toISOString();
  } else {
    config.staff_assignments.push({
      id: `staff_${Date.now()}`,
      email: cleanEmail,
      name: name.trim() || cleanEmail.split('@')[0],
      role: roleId,
      assigned_at: new Date().toISOString()
    });
  }

  writeConfig(config);
  return { success: true, email: cleanEmail, role: roleId };
}

module.exports = {
  getRolesConfig,
  getRole,
  isPageAllowedForRole,
  createRole,
  updateRole,
  deleteRole,
  getStaffAssignments,
  assignStaffRole
};
