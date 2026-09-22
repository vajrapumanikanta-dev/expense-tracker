/**
 * Export & Data Management Module
 * Handles CSV export/import, JSON backup/restore, and printable financial reports.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class ExportManager {
  constructor() {}

  // Export Transactions as CSV
  exportCSV() {
    const transactions = store.getState().transactions;
    if (transactions.length === 0) {
      window.app.showToast('No transactions to export', 'warning');
      return;
    }

    const headers = ['ID', 'Date', 'Type', 'Merchant/Description', 'Category', 'Account', 'Amount', 'Currency', 'Notes', 'Tags'];
    const rows = transactions.map(tx => {
      const cat = store.getCategoryById(tx.categoryId);
      const acc = store.getAccountById(tx.accountId);
      const tagsStr = (tx.tags || []).join(';');
      return [
        `"${tx.id}"`,
        `"${tx.date}"`,
        `"${tx.type}"`,
        `"${(tx.merchant || tx.description || '').replace(/"/g, '""')}"`,
        `"${cat.name}"`,
        `"${acc.name}"`,
        tx.amount,
        `"${store.getState().preferences.currency}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        `"${tagsStr}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    this.downloadFile(csvContent, `vault_expense_transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    audio.playSuccess();
    window.app.showToast('CSV export downloaded', 'success');
  }

  // Export Full JSON Backup
  exportJSON() {
    const state = store.getState();
    const jsonStr = JSON.stringify(state, null, 2);
    this.downloadFile(jsonStr, `vault_expense_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json;charset=utf-8;');
    audio.playSuccess();
    window.app.showToast('Full JSON backup downloaded', 'success');
  }

  // Import JSON Backup
  importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        store.importState(parsed);
        audio.playSuccess();
        window.app.showToast('Data backup restored successfully!', 'success');
        window.app.refreshActiveViews();
      } catch (err) {
        audio.playWarning();
        window.app.showToast('Invalid JSON backup file', 'error');
      }
    };
    reader.readAsText(file);
  }

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Generate & Trigger Print Report
  printReport() {
    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const accounts = state.accounts;
    const netWorth = store.getNetWorth();
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let categoryBreakdownRows = '';
    Object.entries(stats.categorySpendMap).forEach(([catId, amount]) => {
      const cat = store.getCategoryById(catId);
      const pct = stats.totalExpenses > 0 ? ((amount / stats.totalExpenses) * 100).toFixed(1) : 0;
      categoryBreakdownRows += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cat.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${store.formatCurrency(amount)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${pct}%</td>
        </tr>
      `;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.app.showToast('Please allow popups to generate printable report', 'warning');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Summary Statement - ${dateStr}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: auto; }
          h1 { margin-bottom: 4px; color: #0f172a; }
          .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
          .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .stat-box .title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .stat-box .val { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>VaultExpense Financial Statement</h1>
            <div style="color: #64748b; font-size: 14px;">Comprehensive Monthly Audit & Net Worth Report</div>
          </div>
          <div style="text-align: right; font-size: 13px; color: #64748b;">
            Generated on: <strong>${dateStr}</strong>
          </div>
        </div>

        <div class="summary-grid">
          <div class="stat-box">
            <div class="title">Total Net Worth</div>
            <div class="val">${store.formatCurrency(netWorth)}</div>
          </div>
          <div class="stat-box">
            <div class="title">Month Inflow (Income)</div>
            <div class="val" style="color: #10b981;">+${store.formatCurrency(stats.totalIncome)}</div>
          </div>
          <div class="stat-box">
            <div class="title">Month Outflow (Expenses)</div>
            <div class="val" style="color: #f43f5e;">-${store.formatCurrency(stats.totalExpenses)}</div>
          </div>
        </div>

        <h3>Monthly Category Spending Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th style="text-align: right;">Amount Spent</th>
              <th style="text-align: right;">Share</th>
            </tr>
          </thead>
          <tbody>
            ${categoryBreakdownRows || '<tr><td colspan="3" style="text-align: center; padding: 12px;">No expenses recorded</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Confidential financial report generated by VaultExpense Expense Tracker • All records encrypted locally.
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

export const exportManager = new ExportManager();
window.exportManager = exportManager;
