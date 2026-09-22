/**
 * Main Application Orchestrator
 * Connects all modules, manages navigation, authentication, RBAC routing,
 * global modals, forms, keyboard shortcuts, and theme engine.
 */

import { auth } from './auth.js';
import { store } from './store.js';
import { audio } from './audio.js';
import { adminManager } from './admin.js';
import { chartManager } from './charts.js';
import { txManager } from './transactions.js';
import { budgetManager } from './budgets.js';
import { accountsManager } from './accounts.js';
import { recurringManager } from './recurring.js';
import { goalsManager } from './goals.js';
import { receiptScanner } from './receiptScanner.js';
import { exportManager } from './export.js';

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.init();
  }

  init() {
    this.applyTheme(store.getState().preferences.theme || 'dark');
    this.setupNavigation();
    this.setupGlobalControls();
    this.setupAuthControls();
    this.setupModalsAndForms();
    this.setupAdminModals();
    this.setupKeyboardShortcuts();
    receiptScanner.initDropzone();
    adminManager.init();

    // Subscribe to store state updates
    store.subscribe((state, eventType) => {
      this.refreshKPIs();
      if (['transaction_added', 'transaction_updated', 'transaction_deleted', 'transactions_batch_deleted', 'account_added', 'account_updated', 'account_deleted', 'data_reset', 'data_imported', 'preference_changed', 'category_added', 'category_updated', 'category_deleted'].includes(eventType)) {
        this.populateSelects();
      }
    });

    // Subscribe to auth state updates
    auth.subscribe((event, data, user) => {
      this.updateUserProfileHeader();
      this.updateSidebarVisibility();
      if (['login_success', 'signup_success'].includes(event)) {
        this.closeAllModals();
        this.showToast(`Welcome back, ${user.name}!`, 'success');
        if (user.role === 'admin') {
          this.navigate('admin-dashboard');
        } else {
          this.navigate('dashboard');
        }
      } else if (event === 'logout_success') {
        this.showToast('You have been signed out.', 'info');
        this.navigate('dashboard');
      }
    });

    // Initial render
    this.updateUserProfileHeader();
    this.updateSidebarVisibility();
    this.populateSelects();
    this.refreshActiveViews();
    this.refreshKPIs();

    // If starting on admin user, redirect to admin-dashboard
    if (auth.isAdmin()) {
      this.navigate('admin-dashboard');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- USER PROFILE & SIDEBAR ROLE VISIBILITY ---
  updateUserProfileHeader() {
    const user = auth.getCurrentUser();
    const avatarEl = document.getElementById('headerUserAvatar');
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const dropNameEl = document.getElementById('dropUserName');
    const dropEmailEl = document.getElementById('dropUserEmail');
    const dropBadgeEl = document.getElementById('dropUserBadge');
    const sidebarRoleBadge = document.getElementById('sidebarRoleBadge');
    const dropRoleSwitchText = document.getElementById('dropRoleSwitchText');

    if (user) {
      const initials = (user.name || 'User')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role.toUpperCase();
      if (dropNameEl) dropNameEl.textContent = user.name;
      if (dropEmailEl) dropEmailEl.textContent = user.email;
      if (dropBadgeEl) {
        dropBadgeEl.textContent = user.role === 'admin' ? '🛡️ Admin Account' : '👤 User Account';
        dropBadgeEl.className = `badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-[10px] font-bold uppercase`;
      }
      if (sidebarRoleBadge) {
        sidebarRoleBadge.textContent = user.role;
        sidebarRoleBadge.className = `badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} text-[9px] font-bold uppercase`;
      }
      if (dropRoleSwitchText) {
        dropRoleSwitchText.textContent = user.role === 'admin' ? 'Toggle Admin / User View' : 'Request Admin Privileges';
      }
    }
  }

  updateSidebarVisibility() {
    const isAdmin = auth.isAdmin();
    const adminSection = document.getElementById('adminNavSection');
    if (adminSection) {
      if (isAdmin) {
        adminSection.classList.remove('hidden');
      } else {
        adminSection.classList.add('hidden');
      }
    }
  }

  toggleAdminUserSwitch() {
    const user = auth.getCurrentUser();
    if (!user) return;

    if (user.role !== 'admin') {
      this.showToast('Administrator privileges required to access Admin Portal.', 'warning');
      this.openAuthModal();
      return;
    }

    // Toggle between admin dashboard and user dashboard
    if (this.currentView.startsWith('admin-')) {
      this.navigate('dashboard');
    } else {
      this.navigate('admin-dashboard');
    }
    this.closeUserDropdown();
  }

  // --- VIEW NAVIGATION & RBAC GUARDS ---
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.dataset.view;
        this.navigate(viewId);
        audio.playClick();
      });
    });

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobileSidebarToggle');
    const sidebar = document.getElementById('appSidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
      navItems.forEach(item => {
        item.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
      });
    }
  }

  navigate(viewId) {
    // RBAC Route Guard: Admin views require admin role
    if (viewId.startsWith('admin-') && !auth.isAdmin()) {
      this.showToast('Access Denied: Admin role required for this module.', 'danger');
      audio.playError?.();
      viewId = 'dashboard';
    }

    this.currentView = viewId;

    // Update Sidebar Active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Update Visible View Panel
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${viewId}`);
    });

    // Update Header Titles
    const titles = {
      // User Views
      dashboard: { title: 'Dashboard Overview', sub: 'Real-time wealth tracking & spending velocity' },
      transactions: { title: 'Transactions Ledger', sub: 'Audited log of inflows, expenses & transfers' },
      budgets: { title: 'Budgets & Overspend Alerts', sub: 'Monthly targets with burn rate projections' },
      analytics: { title: 'Financial Analytics & Insights', sub: 'Cash flow dynamics, category shares & trends' },
      accounts: { title: 'Multi-Account Portfolio', sub: 'Liquid assets, credit cards & investment tracking' },
      recurring: { title: 'Recurring Bills & Subscriptions', sub: 'Upcoming bill alerts and 1-click ledger logging' },
      goals: { title: 'Savings Goals & Discipline', sub: 'Target-based saving & gamified discipline streaks' },
      settings: { title: 'Data Export & System Settings', sub: 'CSV/JSON backup, printable statement & storage' },
      // Admin Views
      'admin-dashboard': { title: 'Administrator Control Center', sub: 'Platform overview, user traffic & liquidity metrics' },
      'admin-users': { title: 'User Account Management', sub: 'Role permissions, account statuses & security controls' },
      'admin-categories': { title: 'Global System Taxonomy', sub: 'Platform categories, icon sets & color palettes' },
      'admin-analytics': { title: 'Macro Platform Telemetry', sub: 'System volume, storage efficiency & performance metrics' },
      'admin-logs': { title: 'Security & Audit Trails', sub: 'Live platform security logs, logins & ledger modifications' }
    };

    const titleEl = document.getElementById('headerTitle');
    const subEl = document.getElementById('headerSubtitle');
    if (titleEl && subEl && titles[viewId]) {
      titleEl.textContent = titles[viewId].title;
      subEl.textContent = titles[viewId].sub;
    }

    this.refreshActiveViews();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  refreshActiveViews() {
    this.refreshKPIs();
    if (this.currentView.startsWith('admin-')) {
      adminManager.refreshAll();
    } else {
      txManager.render();
      budgetManager.render();
      accountsManager.render();
      recurringManager.render();
      goalsManager.render();
      chartManager.initOrUpdateAll();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  refreshKPIs() {
    const stats = store.getCurrentMonthStats();
    const netWorth = store.getNetWorth();

    const nwEl = document.getElementById('kpiNetWorth');
    const incEl = document.getElementById('kpiMonthIncome');
    const expEl = document.getElementById('kpiMonthExpenses');
    const rateEl = document.getElementById('kpiSavingsRate');
    const savedEl = document.getElementById('kpiNetSavings');

    if (nwEl) nwEl.textContent = store.formatCurrency(netWorth);
    if (incEl) incEl.textContent = `+${store.formatCurrency(stats.totalIncome)}`;
    if (expEl) expEl.textContent = `-${store.formatCurrency(stats.totalExpenses)}`;
    if (rateEl) rateEl.textContent = `${stats.savingsRate}%`;
    if (savedEl) savedEl.textContent = `${stats.netSavings >= 0 ? '+' : ''}${store.formatCurrency(stats.netSavings)} saved`;
  }

  // --- HEADER & GLOBAL CONTROLS ---
  setupGlobalControls() {
    // Currency Selector
    const currSelect = document.getElementById('currencySelect');
    if (currSelect) {
      currSelect.value = store.getState().preferences.currency || 'INR';
      currSelect.addEventListener('change', (e) => {
        store.setPreference('currency', e.target.value);
        audio.playClick();
        this.showToast(`Currency set to ${e.target.value}`, 'info');
        this.refreshActiveViews();
      });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = store.getState().preferences.theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        store.setPreference('theme', next);
        audio.playClick();
        chartManager.initOrUpdateAll();
      });
    }

    // Sound Toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const current = store.getState().preferences.soundEnabled !== false;
        store.setPreference('soundEnabled', !current);
        soundBtn.innerHTML = !current ? '<i data-lucide="volume-2" class="w-4 h-4"></i>' : '<i data-lucide="volume-x" class="w-4 h-4"></i>';
        if (window.lucide) window.lucide.createIcons();
        this.showToast(!current ? 'Sound effects enabled' : 'Sound effects muted', 'info');
      });
    }

    // Quick Add Transaction Button
    const quickAddBtn = document.getElementById('quickAddTxBtn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.openTransactionModal());
    }

    // Receipt Scanner Button
    const scannerBtn = document.getElementById('openScannerBtn');
    if (scannerBtn) {
      scannerBtn.addEventListener('click', () => this.openScannerModal());
    }

    // Transaction Filters bindings
    const searchInput = document.getElementById('txSearchInput');
    const typeFilter = document.getElementById('txTypeFilter');
    const catFilter = document.getElementById('txCategoryFilter');
    const accFilter = document.getElementById('txAccountFilter');
    const dateFilter = document.getElementById('txDateFilter');

    if (searchInput) searchInput.addEventListener('input', (e) => txManager.setFilter('search', e.target.value));
    if (typeFilter) typeFilter.addEventListener('change', (e) => txManager.setFilter('type', e.target.value));
    if (catFilter) catFilter.addEventListener('change', (e) => txManager.setFilter('categoryId', e.target.value));
    if (accFilter) accFilter.addEventListener('change', (e) => txManager.setFilter('accountId', e.target.value));
    if (dateFilter) dateFilter.addEventListener('change', (e) => txManager.setFilter('dateRange', e.target.value));

    // Batch Delete Transactions Button
    const batchBtn = document.getElementById('txBatchDeleteBtn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => txManager.deleteSelected());
    }

    const selectAllCheckbox = document.getElementById('txSelectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => txManager.toggleSelectAll(e.target.checked));
    }

    // JSON Backup Restore file input
    const jsonInput = document.getElementById('jsonImportInput');
    if (jsonInput) {
      jsonInput.addEventListener('change', (e) => exportManager.importJSON(e));
    }
  }

  // --- AUTH CONTROLS & DROPDOWN ---
  setupAuthControls() {
    const profileBtn = document.getElementById('userProfileBtn');
    const dropdownMenu = document.getElementById('userDropdownMenu');

    if (profileBtn && dropdownMenu) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
        audio.playClick();
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !profileBtn.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
          auth.login({ email, password });
          audio.playSuccess();
        } catch (err) {
          audio.playError?.();
          this.showToast(err.message, 'danger');
        }
      });
    }

    // Signup Form Submit
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const role = document.getElementById('signupRole').value;
        const currency = document.getElementById('signupCurrency').value;

        try {
          auth.signup({ name, email, password, role, currency });
          audio.playSuccess();
        } catch (err) {
          audio.playError?.();
          this.showToast(err.message, 'danger');
        }
      });
    }
  }

  closeUserDropdown() {
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.add('hidden');
  }

  openAuthModal() {
    this.closeUserDropdown();
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('active');
      this.switchAuthTab('login');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  switchAuthTab(tab) {
    const loginBtn = document.getElementById('authTabLogin');
    const signupBtn = document.getElementById('authTabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (tab === 'login') {
      loginBtn?.classList.add('active');
      signupBtn?.classList.remove('active');
      loginForm?.classList.remove('hidden');
      signupForm?.classList.add('hidden');
    } else {
      loginBtn?.classList.remove('active');
      signupBtn?.classList.add('active');
      loginForm?.classList.add('hidden');
      signupForm?.classList.remove('hidden');
    }
    audio.playClick();
  }

  fillQuickAuth(email, password) {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    if (emailInput && passInput) {
      emailInput.value = email;
      passInput.value = password;
      audio.playClick();
    }
  }

  handleLogout() {
    this.closeUserDropdown();
    auth.logout();
  }

  openVivaModal() {
    this.closeUserDropdown();
    const modal = document.getElementById('vivaModal');
    if (modal) {
      modal.classList.add('active');
      audio.playClick();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  openAdminUserModal() {
    const modal = document.getElementById('adminUserModal');
    const form = document.getElementById('adminCreateUserForm');
    if (modal && form) {
      form.reset();
      modal.classList.add('active');
      audio.playClick();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  setupAdminModals() {
    // Admin Create User Form
    const adminUserForm = document.getElementById('adminCreateUserForm');
    if (adminUserForm) {
      adminUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('admNewName').value;
        const email = document.getElementById('admNewEmail').value;
        const role = document.getElementById('admNewRole').value;
        const currency = document.getElementById('admNewCurrency').value;
        const password = document.getElementById('admNewPassword').value;

        try {
          const newUser = auth.adminCreateUser({ name, email, role, currency, password });
          store.addAuditLog('ADMIN_CREATE_USER', `Administrator created user ${newUser.name} (${newUser.email})`, auth.getCurrentUser()?.name, 'SUCCESS');
          audio.playSuccess();
          this.showToast(`User ${newUser.name} created successfully.`, 'success');
          this.closeAllModals();
          adminManager.renderUsersTable();
          adminManager.renderDashboard();
        } catch (err) {
          this.showToast(err.message, 'danger');
        }
      });
    }

    // Admin Category Form
    const adminCatForm = document.getElementById('adminCategoryForm');
    if (adminCatForm) {
      adminCatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('adminCatId').value;
        const name = document.getElementById('adminCatName').value;
        const type = document.getElementById('adminCatType').value;
        const color = document.getElementById('adminCatColor').value;
        const icon = document.getElementById('adminCatIcon').value;

        if (id) {
          store.updateGlobalCategory(id, { name, type, color, icon });
          this.showToast('Global category updated.', 'success');
        } else {
          store.addGlobalCategory({ name, type, color, icon });
          this.showToast('New global category added.', 'success');
        }

        audio.playSuccess();
        this.closeAllModals();
        adminManager.renderCategoriesTable();
        adminManager.renderDashboard();
        this.populateSelects();
      });
    }
  }

  // --- MODALS & FORMS ---
  setupModalsAndForms() {
    // Backdrop click to close modals
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeAllModals();
      });
    });

    // Transaction Modal Submit
    const txForm = document.getElementById('txForm');
    if (txForm) {
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTransactionSubmit();
      });

      // Type toggles in Tx modal
      document.querySelectorAll('.tx-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tx-type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const type = btn.dataset.type;
          document.getElementById('txFormType').value = type;

          const toAccGroup = document.getElementById('txToAccountGroup');
          const catGroup = document.getElementById('txCategoryGroup');

          if (type === 'transfer') {
            toAccGroup?.classList.remove('hidden');
            catGroup?.classList.add('hidden');
          } else {
            toAccGroup?.classList.add('hidden');
            catGroup?.classList.remove('hidden');
          }
          audio.playClick();
        });
      });
    }

    // Transfer Modal Submit
    const transferForm = document.getElementById('transferForm');
    if (transferForm) {
      transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTransferSubmit();
      });
    }

    // Budget Form Submit
    const budgetForm = document.getElementById('budgetForm');
    if (budgetForm) {
      budgetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        budgetManager.handleSubmit();
      });
    }

    // Account Form Submit
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
      accountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        accountsManager.handleSubmit();
      });
    }

    // Recurring Form Submit
    const recurringForm = document.getElementById('recurringForm');
    if (recurringForm) {
      recurringForm.addEventListener('submit', (e) => {
        e.preventDefault();
        recurringManager.handleSubmit();
      });
    }

    // Goal Form Submit
    const goalForm = document.getElementById('goalForm');
    if (goalForm) {
      goalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goalsManager.handleSubmit();
      });
    }

    // Goal Contribution Submit
    const contribForm = document.getElementById('contributeForm');
    if (contribForm) {
      contribForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goalsManager.handleContributeSubmit();
      });
    }
  }

  // --- TRANSACTION HANDLERS ---
  openTransactionModal(txId = null) {
    const modal = document.getElementById('txModal');
    const form = document.getElementById('txForm');
    const title = document.getElementById('txModalTitle');
    const submitBtn = document.getElementById('txFormSubmitBtn');

    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('txFormDate').value = todayStr;

    if (txId) {
      const tx = store.getState().transactions.find(t => t.id === txId);
      if (tx) {
        document.getElementById('txFormId').value = tx.id;
        document.getElementById('txFormAmount').value = tx.amount;
        document.getElementById('txFormMerchant').value = tx.merchant || tx.description;
        document.getElementById('txFormDate').value = tx.date;
        document.getElementById('txFormCategory').value = tx.categoryId;
        document.getElementById('txFormAccount').value = tx.accountId;
        document.getElementById('txFormTags').value = (tx.tags || []).join(', ');
        document.getElementById('txFormNotes').value = tx.notes || '';
        document.getElementById('txFormType').value = tx.type;

        document.querySelectorAll('.tx-type-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.type === tx.type);
        });

        title.textContent = 'Edit Transaction';
        submitBtn.textContent = 'Update Transaction';
      }
    } else {
      document.getElementById('txFormId').value = '';
      title.textContent = 'Add New Transaction';
      submitBtn.textContent = 'Save Transaction';
      document.querySelectorAll('.tx-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'expense');
      });
      document.getElementById('txFormType').value = 'expense';
      document.getElementById('txToAccountGroup')?.classList.add('hidden');
      document.getElementById('txCategoryGroup')?.classList.remove('hidden');
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openTxModal(txId = null) {
    this.openTransactionModal(txId);
  }

  handleTransactionSubmit() {
    const id = document.getElementById('txFormId').value;
    const type = document.getElementById('txFormType').value;
    const amount = parseFloat(document.getElementById('txFormAmount').value);
    const merchant = document.getElementById('txFormMerchant').value.trim();
    const date = document.getElementById('txFormDate').value;
    const accountId = document.getElementById('txFormAccount').value;
    const categoryId = type === 'transfer' ? 'cat_transfer' : document.getElementById('txFormCategory').value;
    const toAccountId = type === 'transfer' ? document.getElementById('txFormToAccount').value : null;
    const tagsRaw = document.getElementById('txFormTags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const notes = document.getElementById('txFormNotes').value.trim();

    if (!amount || isNaN(amount) || amount <= 0) {
      this.showToast('Please enter a valid amount greater than 0', 'danger');
      return;
    }

    const txData = {
      description: merchant,
      merchant,
      amount,
      type,
      date,
      categoryId,
      accountId,
      toAccountId,
      tags,
      notes
    };

    if (id) {
      store.updateTransaction(id, txData);
      this.showToast('Transaction updated successfully', 'success');
      audio.playSuccess();
    } else {
      store.addTransaction(txData);
      this.showToast('Transaction recorded to ledger', 'success');
      audio.playCoin();
    }

    this.closeAllModals();
    this.refreshActiveViews();
  }

  // --- TRANSFER MODAL ---
  openTransferModal() {
    const modal = document.getElementById('transferModal');
    const form = document.getElementById('transferForm');
    if (!modal || !form) return;

    form.reset();
    this.populateSelects();

    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
    audio.playClick();
  }

  handleTransferSubmit() {
    const fromAcc = document.getElementById('transferFromAccount').value;
    const toAcc = document.getElementById('transferToAccount').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const date = document.getElementById('transferDate').value;
    const notes = document.getElementById('transferNotes').value.trim();

    if (fromAcc === toAcc) {
      this.showToast('Source and destination accounts must be different', 'warning');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid transfer amount', 'danger');
      return;
    }

    const fromAccObj = store.getAccountById(fromAcc);
    const toAccObj = store.getAccountById(toAcc);

    store.addTransaction({
      description: `Transfer to ${toAccObj.name}`,
      merchant: `Transfer: ${fromAccObj.name} → ${toAccObj.name}`,
      amount,
      type: 'transfer',
      categoryId: 'cat_transfer',
      accountId: fromAcc,
      toAccountId: toAcc,
      date,
      notes,
      tags: ['transfer', 'internal']
    });

    audio.playSuccess();
    this.showToast(`Transferred ${store.formatCurrency(amount)} successfully`, 'success');
    this.closeAllModals();
    this.refreshActiveViews();
  }

  // --- MODAL UTILITIES ---
  openBudgetModal(categoryId = null) {
    const modal = document.getElementById('budgetModal');
    const form = document.getElementById('budgetForm');
    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    if (categoryId) {
      const budget = store.getState().budgets.find(b => b.categoryId === categoryId);
      if (budget) {
        document.getElementById('budgetCategorySelect').value = budget.categoryId;
        document.getElementById('budgetLimitInput').value = budget.limit;
        document.getElementById('budgetThresholdInput').value = budget.alertThreshold || 80;
      }
    }
    modal.classList.add('active');
    audio.playClick();
  }

  openAccountModal(accId = null) {
    const modal = document.getElementById('accountModal');
    const form = document.getElementById('accountForm');
    const title = document.getElementById('accountModalTitle');
    if (!modal || !form) return;
    form.reset();

    if (accId) {
      const acc = store.getState().accounts.find(a => a.id === accId);
      if (acc) {
        document.getElementById('accountFormId').value = acc.id;
        document.getElementById('accFormName').value = acc.name;
        document.getElementById('accFormType').value = acc.type;
        document.getElementById('accFormBalance').value = acc.balance;
        document.getElementById('accFormInstitution').value = acc.institution || '';
        document.getElementById('accFormNumber').value = acc.accountNumber || '';
        title.textContent = 'Edit Account';
      }
    } else {
      document.getElementById('accountFormId').value = '';
      title.textContent = 'Add Financial Account';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openRecurringModal(recId = null) {
    const modal = document.getElementById('recurringModal');
    const form = document.getElementById('recurringForm');
    const title = document.getElementById('recurringModalTitle');
    if (!modal || !form) return;
    form.reset();
    this.populateSelects();

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('recFormNextDate').value = todayStr;

    if (recId) {
      const rec = store.getState().recurringBills.find(r => r.id === recId);
      if (rec) {
        document.getElementById('recFormId').value = rec.id;
        document.getElementById('recFormName').value = rec.name;
        document.getElementById('recFormAmount').value = rec.amount;
        document.getElementById('recFormFrequency').value = rec.frequency;
        document.getElementById('recFormCategory').value = rec.categoryId;
        document.getElementById('recFormAccount').value = rec.accountId;
        document.getElementById('recFormNextDate').value = rec.nextDueDate;
        title.textContent = 'Edit Recurring Subscription';
      }
    } else {
      document.getElementById('recFormId').value = '';
      title.textContent = 'Add Recurring Subscription';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openGoalModal(goalId = null) {
    const modal = document.getElementById('goalModal');
    const form = document.getElementById('goalForm');
    const title = document.getElementById('goalModalTitle');
    if (!modal || !form) return;
    form.reset();

    if (goalId) {
      const g = store.getState().goals.find(goal => goal.id === goalId);
      if (g) {
        document.getElementById('goalFormId').value = g.id;
        document.getElementById('goalFormName').value = g.name;
        document.getElementById('goalFormTarget').value = g.targetAmount;
        document.getElementById('goalFormCurrent').value = g.currentAmount;
        document.getElementById('goalFormDate').value = g.targetDate || '';
        document.getElementById('goalFormCategory').value = g.category || '';
        document.getElementById('goalFormNotes').value = g.notes || '';
        title.textContent = 'Edit Savings Goal';
      }
    } else {
      document.getElementById('goalFormId').value = '';
      title.textContent = 'Create Savings Goal';
    }

    modal.classList.add('active');
    audio.playClick();
  }

  openScannerModal() {
    const modal = document.getElementById('scannerModal');
    if (modal) {
      modal.classList.add('active');
      audio.playClick();
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    this.closeUserDropdown();
  }

  // --- POPULATE SELECT DROPDOWNS ---
  populateSelects() {
    const state = store.getState();

    // 1. Transaction Form Category Select
    const txCatSelect = document.getElementById('txFormCategory');
    if (txCatSelect) {
      txCatSelect.innerHTML = state.categories
        .filter(c => c.type !== 'transfer')
        .map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`)
        .join('');
    }

    // 2. Transaction Filter Category Select
    const txFilterCatSelect = document.getElementById('txCategoryFilter');
    if (txFilterCatSelect) {
      txFilterCatSelect.innerHTML = '<option value="all">All Categories</option>' + state.categories
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }

    // 3. Transaction Form Account Select
    const txAccSelect = document.getElementById('txFormAccount');
    if (txAccSelect) {
      txAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance, a.currency)})</option>`)
        .join('');
    }

    // 4. Transaction Form ToAccount Select (Transfers)
    const txToAccSelect = document.getElementById('txFormToAccount');
    if (txToAccSelect) {
      txToAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 5. Transaction Filter Account Select
    const txFilterAccSelect = document.getElementById('txAccountFilter');
    if (txFilterAccSelect) {
      txFilterAccSelect.innerHTML = '<option value="all">All Accounts</option>' + state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 6. Transfer Wizard From & To
    const transFromSelect = document.getElementById('transferFromAccount');
    const transToSelect = document.getElementById('transferToAccount');
    if (transFromSelect && transToSelect) {
      const accOptions = state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance)})</option>`)
        .join('');
      transFromSelect.innerHTML = accOptions;
      transToSelect.innerHTML = accOptions;
      if (state.accounts.length > 1) {
        transToSelect.selectedIndex = 1;
      }
    }

    // 7. Budget Category Select
    const budgetCatSelect = document.getElementById('budgetCategorySelect');
    if (budgetCatSelect) {
      budgetCatSelect.innerHTML = state.categories
        .filter(c => c.type === 'expense')
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }

    // 8. Recurring Category & Account Select
    const recCatSelect = document.getElementById('recFormCategory');
    const recAccSelect = document.getElementById('recFormAccount');
    if (recCatSelect) {
      recCatSelect.innerHTML = state.categories
        .filter(c => c.type === 'expense')
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }
    if (recAccSelect) {
      recAccSelect.innerHTML = state.accounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
    }

    // 9. Goal Contribution Account Select
    const contribAccSelect = document.getElementById('contribFromAccount');
    if (contribAccSelect) {
      contribAccSelect.innerHTML = '<option value="">None (Don\'t debit account)</option>' + state.accounts
        .map(a => `<option value="${a.id}">${a.name} (${store.formatCurrency(a.balance)})</option>`)
        .join('');
    }
  }

  // --- KEYBOARD SHORTCUTS ---
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape closes all modals
      if (e.key === 'Escape') {
        this.closeAllModals();
        return;
      }

      // Don't trigger shortcuts if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.openTransactionModal();
      } else if (e.key === '/') {
        e.preventDefault();
        const search = document.getElementById('txSearchInput');
        if (search) {
          this.navigate('transactions');
          search.focus();
        }
      }
    });
  }

  // --- THEME & TOAST ENGINE ---
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type === 'danger' ? 'error' : type}`;

    const iconMap = {
      success: 'check-circle-2',
      danger: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info'
    };

    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i data-lucide="${iconMap[type] || 'info'}" class="w-4 h-4"></i>
        <span class="text-xs font-semibold text-foreground">${message}</span>
      </div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  resetDemoData() {
    if (confirm('Are you sure you want to reset your ledger data to default sample transactions?')) {
      store.resetToDemoData();
      audio.playSuccess();
      this.showToast('Demo data reloaded successfully', 'success');
      this.refreshActiveViews();
    }
  }
}

// Instantiate and expose globally
export const app = new App();
window.app = app;
