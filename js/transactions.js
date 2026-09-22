/**
 * Transactions Ledger Manager
 * Handles listing, filtering, search, pagination, batch actions, and modal editing.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class TransactionsManager {
  constructor() {
    this.filters = {
      search: '',
      type: 'all',
      categoryId: 'all',
      accountId: 'all',
      dateRange: 'all',
      sortBy: 'date-desc'
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.selectedIds = new Set();
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this.currentPage = 1;
    this.render();
  }

  resetFilters() {
    this.filters = {
      search: '',
      type: 'all',
      categoryId: 'all',
      accountId: 'all',
      dateRange: 'all',
      sortBy: 'date-desc'
    };
    this.currentPage = 1;
    this.selectedIds.clear();
    this.syncFilterInputs();
    this.render();
  }

  syncFilterInputs() {
    const searchInput = document.getElementById('txSearchInput');
    const typeSelect = document.getElementById('txTypeFilter');
    const catSelect = document.getElementById('txCategoryFilter');
    const accSelect = document.getElementById('txAccountFilter');
    const sortSelect = document.getElementById('txSortSelect');

    if (searchInput) searchInput.value = this.filters.search;
    if (typeSelect) typeSelect.value = this.filters.type;
    if (catSelect) catSelect.value = this.filters.categoryId;
    if (accSelect) accSelect.value = this.filters.accountId;
    if (sortSelect) sortSelect.value = this.filters.sortBy;
  }

  getFilteredTransactions() {
    const state = store.getState();
    let list = [...state.transactions];

    // Search query
    if (this.filters.search.trim()) {
      const q = this.filters.search.toLowerCase().trim();
      list = list.filter(tx => {
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const merchMatch = (tx.merchant || '').toLowerCase().includes(q);
        const notesMatch = (tx.notes || '').toLowerCase().includes(q);
        const tagMatch = tx.tags && tx.tags.some(t => t.toLowerCase().includes(q));
        const amtMatch = tx.amount.toString().includes(q);
        return descMatch || merchMatch || notesMatch || tagMatch || amtMatch;
      });
    }

    // Type filter
    if (this.filters.type !== 'all') {
      list = list.filter(tx => tx.type === this.filters.type);
    }

    // Category filter
    if (this.filters.categoryId !== 'all') {
      list = list.filter(tx => tx.categoryId === this.filters.categoryId);
    }

    // Account filter
    if (this.filters.accountId !== 'all') {
      list = list.filter(tx => tx.accountId === this.filters.accountId || tx.toAccountId === this.filters.accountId);
    }

    // Date range filter
    if (this.filters.dateRange !== 'all') {
      const now = new Date();
      list = list.filter(tx => {
        const d = new Date(tx.date);
        if (this.filters.dateRange === 'today') {
          return d.toDateString() === now.toDateString();
        }
        if (this.filters.dateRange === 'this_week') {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 7;
        }
        if (this.filters.dateRange === 'this_month') {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        if (this.filters.dateRange === 'last_30_days') {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        }
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (this.filters.sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (this.filters.sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (this.filters.sortBy === 'amount-desc') return b.amount - a.amount;
      if (this.filters.sortBy === 'amount-asc') return a.amount - b.amount;
      if (this.filters.sortBy === 'merchant') return (a.merchant || a.description).localeCompare(b.merchant || b.description);
      return 0;
    });

    return list;
  }

  toggleSelectAll(checked) {
    const list = this.getFilteredTransactions();
    if (checked) {
      list.forEach(tx => this.selectedIds.add(tx.id));
    } else {
      this.selectedIds.clear();
    }
    this.render();
  }

  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.renderBatchBar();
    const rowCheckbox = document.querySelector(`.tx-select-checkbox[data-id="${id}"]`);
    if (rowCheckbox) rowCheckbox.checked = this.selectedIds.has(id);
  }

  renderBatchBar() {
    const batchBar = document.getElementById('txBatchActionBar');
    const batchCount = document.getElementById('txBatchSelectedCount');
    if (!batchBar || !batchCount) return;

    if (this.selectedIds.size > 0) {
      batchBar.classList.remove('hidden');
      batchCount.textContent = `${this.selectedIds.size} selected`;
    } else {
      batchBar.classList.add('hidden');
    }
  }

  deleteBatchSelected() {
    if (this.selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${this.selectedIds.size} selected transactions?`)) {
      store.deleteMultipleTransactions(Array.from(this.selectedIds));
      this.selectedIds.clear();
      audio.playDelete();
      window.app.showToast('Selected transactions deleted', 'success');
      this.render();
    }
  }

  render() {
    this.renderRecentTransactionsDashboard();
    this.renderFullLedger();
    this.renderBatchBar();
  }

  // Mini table for the Dashboard view
  renderRecentTransactionsDashboard() {
    const container = document.getElementById('recentTransactionsList');
    if (!container) return;

    const txList = store.getState().transactions.slice(0, 6);

    if (txList.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-8 text-center">
          <i data-lucide="receipt" class="w-10 h-10 text-muted mx-auto mb-2 opacity-50"></i>
          <p class="text-sm text-muted">No transactions recorded yet.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = '';
    txList.forEach(tx => {
      const category = store.getCategoryById(tx.categoryId);
      const account = store.getAccountById(tx.accountId);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const sign = isIncome ? '+' : (isTransfer ? '⇄' : '-');
      const amountClass = isIncome ? 'text-emerald-500' : (isTransfer ? 'text-indigo-400' : 'text-rose-500');

      html += `
        <div class="transaction-row-mini flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition cursor-pointer" onclick="window.txManager.openEditModal('${tx.id}')">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${category.color}20; color: ${category.color}">
              <i data-lucide="${category.icon || 'receipt'}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="font-medium text-sm text-foreground flex items-center gap-2">
                <span>${tx.merchant || tx.description}</span>
                ${tx.tags && tx.tags.length ? `<span class="badge-tag text-xs">${tx.tags[0]}</span>` : ''}
              </div>
              <div class="text-xs text-muted flex items-center gap-2 mt-0.5">
                <span>${category.name}</span>
                <span>•</span>
                <span>${account.name}</span>
                <span>•</span>
                <span>${tx.date}</span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <span class="font-semibold text-sm ${amountClass}">
              ${sign} ${store.formatCurrency(tx.amount)}
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // Full table for the Transactions Ledger page
  renderFullLedger() {
    const tbody = document.getElementById('txTableBody');
    const countLabel = document.getElementById('txFilteredCount');
    const paginationEl = document.getElementById('txPagination');
    if (!tbody) return;

    const filtered = this.getFilteredTransactions();
    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} transactions`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12">
            <div class="empty-state">
              <i data-lucide="search-x" class="w-12 h-12 text-muted mx-auto mb-3 opacity-40"></i>
              <p class="text-base font-medium text-foreground">No matching transactions found</p>
              <p class="text-sm text-muted mt-1">Try clearing filters or adding a new transaction.</p>
              <button class="btn btn-secondary btn-sm mt-4" onclick="window.txManager.resetFilters()">
                Reset Filters
              </button>
            </div>
          </td>
        </tr>
      `;
      if (paginationEl) paginationEl.innerHTML = '';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    let html = '';
    pageItems.forEach(tx => {
      const cat = store.getCategoryById(tx.categoryId);
      const acc = store.getAccountById(tx.accountId);
      const toAcc = tx.toAccountId ? store.getAccountById(tx.toAccountId) : null;
      const isSelected = this.selectedIds.has(tx.id);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const sign = isIncome ? '+' : (isTransfer ? '⇄ ' : '-');
      const amountClass = isIncome ? 'text-emerald-500 font-semibold' : (isTransfer ? 'text-indigo-400 font-semibold' : 'text-rose-500 font-semibold');

      html += `
        <tr class="ledger-row ${isSelected ? 'bg-indigo-500/10' : ''} hover:bg-surface-hover transition border-b border-border/40">
          <td class="px-4 py-3 text-center">
            <input type="checkbox" class="tx-select-checkbox rounded custom-checkbox" data-id="${tx.id}" ${isSelected ? 'checked' : ''} onchange="window.txManager.toggleSelect('${tx.id}')">
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-muted">
            ${tx.date}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: ${cat.color}25; color: ${cat.color}">
                <i data-lucide="${cat.icon || 'tag'}" class="w-4 h-4"></i>
              </div>
              <div>
                <div class="font-medium text-sm text-foreground">${tx.merchant || tx.description}</div>
                ${tx.notes ? `<div class="text-xs text-muted truncate max-w-xs">${tx.notes}</div>` : ''}
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style="background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}30">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${cat.color}"></span>
              ${cat.name}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-muted whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <i data-lucide="${acc.icon || 'landmark'}" class="w-4 h-4 text-muted"></i>
              <span>${acc.name.split('(')[0]}</span>
              ${toAcc ? `<span class="text-xs text-indigo-400">→ ${toAcc.name.split('(')[0]}</span>` : ''}
            </div>
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap text-sm ${amountClass}">
            ${sign}${store.formatCurrency(tx.amount)}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1">
              <button class="icon-btn-sm" title="Edit" onclick="window.txManager.openEditModal('${tx.id}')">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button class="icon-btn-sm text-rose-500 hover:bg-rose-500/10" title="Delete" onclick="window.txManager.deleteTx('${tx.id}')">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Render Pagination Controls
    if (paginationEl && totalPages > 1) {
      let pageButtons = '';
      for (let p = 1; p <= totalPages; p++) {
        pageButtons += `
          <button class="btn-page ${p === this.currentPage ? 'active' : ''}" onclick="window.txManager.goToPage(${p})">
            ${p}
          </button>
        `;
      }
      paginationEl.innerHTML = `
        <div class="flex items-center justify-between w-full pt-4">
          <span class="text-xs text-muted">Page ${this.currentPage} of ${totalPages}</span>
          <div class="flex items-center gap-1">
            <button class="btn-page" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.txManager.goToPage(${this.currentPage - 1})">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            ${pageButtons}
            <button class="btn-page" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.txManager.goToPage(${this.currentPage + 1})">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderFullLedger();
  }

  deleteTx(id) {
    if (confirm('Delete this transaction? Your account balances will update automatically.')) {
      store.deleteTransaction(id);
      audio.playDelete();
      window.app.showToast('Transaction deleted', 'info');
      this.render();
    }
  }

  openEditModal(id) {
    const tx = store.getState().transactions.find(t => t.id === id);
    if (!tx) return;
    window.app.openTransactionModal(tx);
  }
}

export const txManager = new TransactionsManager();
window.txManager = txManager;
