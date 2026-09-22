/**
 * Admin Module Controller
 * Provides complete administrative control over users, global categories,
 * platform analytics, system audit trails, and backup/restore.
 */

import { auth } from './auth.js';
import { store } from './store.js';
import { audio } from './audio.js';

class AdminManager {
  constructor() {
    this.platformChart = null;
    this.adminCategoryChart = null;
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // User search & filter inputs
    const userSearch = document.getElementById('adminUserSearch');
    const userRoleFilter = document.getElementById('adminUserRoleFilter');
    const userStatusFilter = document.getElementById('adminUserStatusFilter');

    if (userSearch) {
      userSearch.addEventListener('input', () => this.renderUsersTable());
    }
    if (userRoleFilter) {
      userRoleFilter.addEventListener('change', () => this.renderUsersTable());
    }
    if (userStatusFilter) {
      userStatusFilter.addEventListener('change', () => this.renderUsersTable());
    }

    // Audit Log filters
    const logSearch = document.getElementById('adminLogSearch');
    const logActionFilter = document.getElementById('adminLogActionFilter');

    if (logSearch) {
      logSearch.addEventListener('input', () => this.renderAuditLogs());
    }
    if (logActionFilter) {
      logActionFilter.addEventListener('change', () => this.renderAuditLogs());
    }
  }

  // Refresh all admin views
  refreshAll() {
    this.renderDashboard();
    this.renderUsersTable();
    this.renderCategoriesTable();
    this.renderAuditLogs();
    if (window.lucide) window.lucide.createIcons();
  }

  // ==================== 1. ADMIN DASHBOARD ====================
  renderDashboard() {
    const analytics = store.getPlatformAnalytics();

    // Update KPI Elements
    const totalUsersEl = document.getElementById('adminKpiTotalUsers');
    const activeUsersEl = document.getElementById('adminKpiActiveUsers');
    const totalTxEl = document.getElementById('adminKpiTotalTx');
    const totalVolumeEl = document.getElementById('adminKpiTotalVolume');
    const platformInflowEl = document.getElementById('adminKpiInflow');
    const platformOutflowEl = document.getElementById('adminKpiOutflow');

    if (totalUsersEl) totalUsersEl.textContent = analytics.totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = `${analytics.activeUsers} Active (${analytics.suspendedUsers} Suspended)`;
    if (totalTxEl) totalTxEl.textContent = analytics.totalTransactions;
    if (totalVolumeEl) totalVolumeEl.textContent = store.formatCurrency(analytics.totalVolume);
    if (platformInflowEl) platformInflowEl.textContent = `+${store.formatCurrency(analytics.totalIncome)}`;
    if (platformOutflowEl) platformOutflowEl.textContent = `-${store.formatCurrency(analytics.totalExpense)}`;

    // Render Platform Charts
    this.renderPlatformCharts(analytics);
  }

  renderPlatformCharts(analytics) {
    if (!window.Chart) return;

    // 1. Platform Volume / Growth Chart
    const lineCtx = document.getElementById('adminPlatformChartCanvas');
    if (lineCtx) {
      if (this.platformChart) this.platformChart.destroy();

      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
      const volumeData = [125000, 185000, 245000, 310000, 425000, Math.round(analytics.totalVolume || 480000)];
      const activeUserData = [2, 3, 3, 4, 4, analytics.totalUsers];

      this.platformChart = new window.Chart(lineCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Platform Transaction Volume (₹)',
              data: volumeData,
              borderColor: '#6366F1',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Registered Accounts',
              data: activeUserData,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3,
              fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#9CA3AF', font: { family: 'Inter', size: 11 } } },
            tooltip: { backgroundColor: '#1F2937', titleColor: '#F9FAFB', bodyColor: '#E5E7EB' }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF' } },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9CA3AF', callback: (v) => `$${(v / 1000).toFixed(0)}k` }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#10B981', stepSize: 1 }
            }
          }
        }
      });
    }

    // 2. Global Category Breakdown Donut
    const donutCtx = document.getElementById('adminCategoryChartCanvas');
    if (donutCtx) {
      if (this.adminCategoryChart) this.adminCategoryChart.destroy();

      const categories = store.getGlobalCategories();
      const labels = [];
      const data = [];
      const colors = [];

      categories.filter(c => c.type === 'expense').slice(0, 6).forEach(cat => {
        labels.push(cat.name);
        data.push(analytics.categoryVolumeMap[cat.id] || (Math.random() * 800 + 200));
        colors.push(cat.color || '#6366F1');
      });

      this.adminCategoryChart = new window.Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#111827'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { size: 10 } } }
          },
          cutout: '70%'
        }
      });
    }
  }

  // ==================== 2. USER MANAGEMENT ====================
  renderUsersTable() {
    const container = document.getElementById('adminUsersTableBody');
    if (!container) return;

    const searchTerm = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('adminUserRoleFilter')?.value || 'all';
    const statusFilter = document.getElementById('adminUserStatusFilter')?.value || 'all';

    let users = auth.getAllUsers();

    // Filtering
    users = users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });

    if (users.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-muted">
            <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            No users found matching your filters.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = users.map(user => {
      const isCurrentUser = user.id === auth.getCurrentUser()?.id;
      const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

      // Count user's transactions from localStorage
      let txCount = 0;
      try {
        const uData = localStorage.getItem(`vault_expense_user_data_${user.id}`);
        if (uData) txCount = JSON.parse(uData).transactions?.length || 0;
        else if (user.email === 'demo@vault.io') txCount = 15;
      } catch (e) {}

      const initials = (user.name || 'User')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">${initials}</div>
              <div>
                <div class="font-bold text-foreground text-sm flex items-center gap-1.5">
                  ${user.name}
                  ${isCurrentUser ? '<span class="badge badge-primary text-[10px] py-0 px-1.5">You</span>' : ''}
                </div>
                <div class="text-xs text-muted font-mono">${user.email}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-xs font-semibold uppercase">
              ${user.role === 'admin' ? '🛡️ Admin' : '👤 User'}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="badge ${user.status === 'active' ? 'badge-emerald' : 'badge-rose'} text-xs font-semibold">
              ${user.status === 'active' ? '● Active' : '● Suspended'}
            </span>
          </td>
          <td class="py-3 px-4 text-xs text-muted font-mono">${user.currency || 'USD'}</td>
          <td class="py-3 px-4 text-xs text-foreground font-medium">${txCount} txs</td>
          <td class="py-3 px-4 text-xs text-muted">
            <div>Joined: ${createdDate}</div>
            <div class="text-[10px] text-muted/70">Active: ${lastLogin}</div>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${!isCurrentUser ? `
                <button class="icon-btn-sm" title="${user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}" onclick="window.admin.toggleUserStatus('${user.id}')">
                  <i data-lucide="${user.status === 'active' ? 'user-x' : 'user-check'}" class="w-4 h-4 ${user.status === 'active' ? 'text-rose-400' : 'text-emerald-400'}"></i>
                </button>
                <button class="icon-btn-sm" title="${user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}" onclick="window.admin.toggleUserRole('${user.id}')">
                  <i data-lucide="${user.role === 'admin' ? 'shield-minus' : 'shield-check'}" class="w-4 h-4 text-indigo-400"></i>
                </button>
              ` : ''}
              <button class="icon-btn-sm" title="Reset Password" onclick="window.admin.promptResetPassword('${user.id}')">
                <i data-lucide="key" class="w-4 h-4 text-amber-400"></i>
              </button>
              ${!isCurrentUser ? `
                <button class="icon-btn-sm" title="Delete User" onclick="window.admin.deleteUser('${user.id}')">
                  <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  toggleUserStatus(userId) {
    try {
      const user = auth.toggleUserStatus(userId);
      audio.playClick();
      store.addAuditLog('USER_STATUS_CHANGE', `Changed status of ${user.name} to ${user.status}`, auth.getCurrentUser()?.name, 'WARNING');
      window.app.showToast(`User ${user.name} is now ${user.status}.`, user.status === 'active' ? 'success' : 'warning');
      this.renderUsersTable();
      this.renderDashboard();
    } catch (e) {
      window.app.showToast(e.message, 'danger');
    }
  }

  toggleUserRole(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';

    if (confirm(`Are you sure you want to change ${user.name}'s role to ${newRole.toUpperCase()}?`)) {
      try {
        auth.updateUserRole(userId, newRole);
        audio.playClick();
        store.addAuditLog('USER_ROLE_CHANGE', `Changed role of ${user.name} to ${newRole}`, auth.getCurrentUser()?.name, 'WARNING');
        window.app.showToast(`Updated role for ${user.name} to ${newRole}.`, 'success');
        this.renderUsersTable();
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  promptResetPassword(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;

    const newPass = prompt(`Enter new password for ${user.name} (${user.email}):`, 'Password@123');
    if (newPass) {
      try {
        auth.adminResetPassword(userId, newPass);
        audio.playSuccess();
        store.addAuditLog('PASSWORD_RESET', `Administrator reset password for ${user.email}`, auth.getCurrentUser()?.name, 'WARNING');
        window.app.showToast(`Password successfully reset for ${user.name}.`, 'success');
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  deleteUser(userId) {
    const user = auth.getAllUsers().find(u => u.id === userId);
    if (!user) return;

    if (confirm(`CAUTION: Are you sure you want to permanently delete user "${user.name}" (${user.email}) and all their financial records? This action cannot be undone.`)) {
      try {
        auth.deleteUser(userId);
        audio.playDelete();
        store.addAuditLog('DELETE_USER', `Permanently removed user ${user.name} (${user.email})`, auth.getCurrentUser()?.name, 'DANGER');
        window.app.showToast(`User ${user.name} deleted.`, 'info');
        this.renderUsersTable();
        this.renderDashboard();
      } catch (e) {
        window.app.showToast(e.message, 'danger');
      }
    }
  }

  // ==================== 3. GLOBAL CATEGORIES ====================
  renderCategoriesTable() {
    const container = document.getElementById('adminCategoriesTableBody');
    if (!container) return;

    const categories = store.getGlobalCategories();

    container.innerHTML = categories.map(cat => {
      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" style="background-color: ${cat.color || '#6366F1'};">
                <i data-lucide="${cat.icon || 'tag'}" class="w-4 h-4"></i>
              </div>
              <span class="font-semibold text-foreground text-sm">${cat.name}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-muted">${cat.id}</td>
          <td class="py-3 px-4">
            <span class="badge ${cat.type === 'income' ? 'badge-emerald' : cat.type === 'expense' ? 'badge-rose' : 'badge-secondary'} text-xs font-medium uppercase">
              ${cat.type}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full border border-border" style="background-color: ${cat.color};"></span>
              <span class="text-xs font-mono text-muted">${cat.color}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button class="icon-btn-sm" title="Edit Category" onclick="window.admin.openEditCategoryModal('${cat.id}')">
                <i data-lucide="edit-3" class="w-4 h-4 text-indigo-400"></i>
              </button>
              <button class="icon-btn-sm" title="Delete Category" onclick="window.admin.deleteCategory('${cat.id}')">
                <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openAddCategoryModal() {
    const modal = document.getElementById('adminCategoryModal');
    const form = document.getElementById('adminCategoryForm');
    const title = document.getElementById('adminCategoryModalTitle');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('adminCatId').value = '';
    document.getElementById('adminCatColor').value = '#6366F1';
    title.textContent = 'Add Global System Category';
    modal.classList.add('active');
  }

  openEditCategoryModal(id) {
    const categories = store.getGlobalCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const modal = document.getElementById('adminCategoryModal');
    const title = document.getElementById('adminCategoryModalTitle');
    if (!modal) return;

    document.getElementById('adminCatId').value = cat.id;
    document.getElementById('adminCatName').value = cat.name;
    document.getElementById('adminCatType').value = cat.type;
    document.getElementById('adminCatIcon').value = cat.icon || 'tag';
    document.getElementById('adminCatColor').value = cat.color || '#6366F1';

    title.textContent = 'Edit System Category';
    modal.classList.add('active');
  }

  deleteCategory(id) {
    if (confirm('Are you sure you want to delete this global category?')) {
      store.deleteGlobalCategory(id);
      audio.playDelete();
      window.app.showToast('Category deleted successfully.', 'info');
      this.renderCategoriesTable();
      this.renderDashboard();
    }
  }

  // ==================== 4. AUDIT LOGS ====================
  renderAuditLogs() {
    const container = document.getElementById('adminAuditLogsBody');
    if (!container) return;

    const searchTerm = (document.getElementById('adminLogSearch')?.value || '').toLowerCase();
    const actionFilter = document.getElementById('adminLogActionFilter')?.value || 'all';

    let logs = store.getAuditLogs();

    logs = logs.filter(log => {
      const matchesSearch = log.details.toLowerCase().includes(searchTerm) || log.user.toLowerCase().includes(searchTerm) || log.action.toLowerCase().includes(searchTerm);
      const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
      return matchesSearch && matchesAction;
    });

    if (logs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-muted">
            <i data-lucide="shield-alert" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            No audit log records match your search criteria.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = logs.map(log => {
      const timeStr = new Date(log.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const badgeClass = log.status === 'SUCCESS' ? 'badge-emerald' : log.status === 'WARNING' ? 'badge-amber' : log.status === 'DANGER' ? 'badge-rose' : 'badge-secondary';

      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-4 text-xs font-mono text-muted whitespace-nowrap">${timeStr}</td>
          <td class="py-3 px-4">
            <span class="badge badge-secondary text-xs font-mono font-bold">${log.action}</span>
          </td>
          <td class="py-3 px-4 text-xs text-foreground font-medium">${log.details}</td>
          <td class="py-3 px-4">
            <div class="text-xs font-semibold text-foreground">${log.user}</div>
            <div class="text-[10px] text-muted font-mono">${log.role || 'USER'}</div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-muted">${log.ip || '127.0.0.1'}</td>
          <td class="py-3 px-4 text-right">
            <span class="badge ${badgeClass} text-[10px] font-bold">${log.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  exportAuditLogsCSV() {
    const logs = store.getAuditLogs();
    if (logs.length === 0) {
      window.app.showToast('No audit logs available to export.', 'warning');
      return;
    }

    let csv = 'ID,Timestamp,Action,Details,User,Role,Status,IP\n';
    logs.forEach(l => {
      csv += `"${l.id}","${l.timestamp}","${l.action}","${(l.details || '').replace(/"/g, '""')}","${l.user}","${l.role}","${l.status}","${l.ip}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `VaultExpense_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast('Audit logs exported to CSV.', 'success');
  }

  clearAuditLogs() {
    if (confirm('Are you sure you want to clear the system audit trail? A clearance log will be retained.')) {
      store.clearAuditLogs();
      audio.playDelete();
      this.renderAuditLogs();
      window.app.showToast('Audit logs purged.', 'info');
    }
  }

  // ==================== 5. PLATFORM BACKUP & RESTORE ====================
  downloadPlatformBackup() {
    const allUsers = auth.getAllUsers();
    const userStates = {};

    allUsers.forEach(u => {
      const data = localStorage.getItem(`vault_expense_user_data_${u.id}`);
      if (data) userStates[u.id] = JSON.parse(data);
    });

    const fullPlatformData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      platform: 'VaultExpense Financial OS',
      users: allUsers,
      userStates,
      globalCategories: store.getGlobalCategories(),
      auditLogs: store.getAuditLogs()
    };

    const blob = new Blob([JSON.stringify(fullPlatformData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `VaultExpense_FullPlatform_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    store.addAuditLog('SYSTEM_BACKUP', 'Exported full platform JSON backup', auth.getCurrentUser()?.name, 'SUCCESS');
    window.app.showToast('Platform backup archive downloaded successfully.', 'success');
  }
}

export const adminManager = new AdminManager();
window.admin = adminManager;
