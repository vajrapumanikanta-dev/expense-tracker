/**
 * Chart.js Integration & Analytics Visualizations
 * Dynamic dark/light theme aware charts with smooth animations and custom tooltips.
 */

import { store } from './store.js';

class ChartManager {
  constructor() {
    this.cashflowChart = null;
    this.categoryDonutChart = null;
    this.budgetComparisonChart = null;
    this.dailyTrendChart = null;
    this.analyticsBarChart = null;
    this.analyticsLineChart = null;
    this.analyticsDonutChart = null;
    this.analyticsRange = '6m';
  }

  isDarkMode() {
    return store.getState().preferences.theme === 'dark';
  }

  getChartColors() {
    const isDark = this.isDarkMode();
    return {
      text: isDark ? '#CBD5E1' : '#475569',
      heading: isDark ? '#FFFFFF' : '#0F172A',
      grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#FFFFFF' : '#0F172A',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      income: '#10B981',
      incomeLight: 'rgba(16, 185, 129, 0.2)',
      expense: '#F43F5E',
      expenseLight: 'rgba(244, 63, 94, 0.2)',
      accent: '#6366F1',
      accentLight: 'rgba(99, 102, 241, 0.2)'
    };
  }

  initOrUpdateAll() {
    this.renderCashflowChart();
    this.renderCategoryDonut();
    this.renderBudgetComparison();
    this.renderDailyTrend();
    this.renderAnalyticsBarChart();
    this.renderAnalyticsLineChart();
    this.renderAnalyticsDonutChart();
    this.renderAnalyticsCategoryTable();
    this.setupAnalyticsControls();
  }

  // --- 1. Cashflow Chart (Income vs Expense 6-Month or Last 30 Days) ---
  renderCashflowChart() {
    const canvas = document.getElementById('cashflowChartCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const transactions = state.transactions;

    // Group by last 6 months
    const months = [];
    const incomeData = [];
    const expenseData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      months.push(monthLabel);

      let mIncome = 0;
      let mExpense = 0;

      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth()) {
          if (tx.type === 'income') mIncome += tx.amount;
          if (tx.type === 'expense') mExpense += tx.amount;
        }
      });

      incomeData.push(mIncome);
      expenseData.push(mExpense);
    }

    if (this.cashflowChart) {
      this.cashflowChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: colors.income,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.6
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: colors.expense,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12, weight: '500' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 12 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${store.getState().preferences.currency === 'INR' ? '₹' : '$'}${val >= 1000 ? (val / 1000) + 'k' : val}`
            }
          }
        }
      }
    });
  }

  // --- 2. Category Breakdown Donut ---
  renderCategoryDonut() {
    const canvas = document.getElementById('categoryDonutCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const spendMap = stats.categorySpendMap;

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(spendMap).forEach(([catId, amount]) => {
      if (amount > 0) {
        const cat = store.getCategoryById(catId);
        labels.push(cat.name);
        data.push(amount);
        bgColors.push(cat.color || '#6366F1');
      }
    });

    if (data.length === 0) {
      labels.push('No Expenses');
      data.push(1);
      bgColors.push(colors.grid);
    }

    if (this.categoryDonutChart) {
      this.categoryDonutChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.categoryDonutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: bgColors,
            borderColor: this.isDarkMode() ? '#1E293B' : '#FFFFFF',
            borderWidth: 3,
            hoverOffset: 8,
            cutout: '72%'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${store.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Update center label if element exists
    const centerTotalEl = document.getElementById('donutCenterSpend');
    if (centerTotalEl) {
      centerTotalEl.textContent = store.formatCurrency(stats.totalExpenses);
    }
  }

  // --- 3. Budget Comparison Chart ---
  renderBudgetComparison() {
    const canvas = document.getElementById('budgetComparisonCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const stats = store.getCurrentMonthStats();

    const categoryBudgets = state.budgets.filter(b => b.categoryId !== 'all');
    const labels = [];
    const budgetLimits = [];
    const actualSpends = [];

    categoryBudgets.forEach(b => {
      const cat = store.getCategoryById(b.categoryId);
      labels.push(cat.name.split(' ')[0]); // shortened
      budgetLimits.push(b.limit);
      actualSpends.push(stats.categorySpendMap[b.categoryId] || 0);
    });

    if (this.budgetComparisonChart) {
      this.budgetComparisonChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.budgetComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Budget Limit',
            data: budgetLimits,
            backgroundColor: 'rgba(99, 102, 241, 0.3)',
            borderColor: '#6366F1',
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.7
          },
          {
            label: 'Actual Spend',
            data: actualSpends,
            backgroundColor: actualSpends.map((spent, idx) => spent > budgetLimits[idx] ? colors.expense : colors.income),
            borderRadius: 6,
            barPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  // --- 4. Daily Spending Trend (Last 14 Days) ---
  renderDailyTrend() {
    const canvas = document.getElementById('dailyTrendCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const days = [];
    const spendData = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push(`${d.getMonth() + 1}/${d.getDate()}`);

      let dailySum = 0;
      state.transactions.forEach(tx => {
        if (tx.date === dateStr && tx.type === 'expense') {
          dailySum += tx.amount;
        }
      });
      spendData.push(dailySum);
    }

    if (this.dailyTrendChart) {
      this.dailyTrendChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, colors.accentLight);
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    this.dailyTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Daily Expenses',
            data: spendData,
            borderColor: colors.accent,
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colors.accent,
            pointBorderColor: '#FFFFFF',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` Spent: ${store.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  // --- 5. Financial Analytics: Bar Chart (Income vs Spending) ---
  renderAnalyticsBarChart(rangeMonths = (this.analyticsRange === '1y' ? 12 : 6)) {
    const canvas = document.getElementById('analyticsBarChartCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const transactions = state.transactions || [];

    const months = [];
    const incomeData = [];
    const expenseData = [];
    const now = new Date();

    for (let i = rangeMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      months.push(monthLabel);

      let mIncome = 0;
      let mExpense = 0;

      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth()) {
          if (tx.type === 'income') mIncome += (Number(tx.amount) || 0);
          if (tx.type === 'expense') mExpense += (Number(tx.amount) || 0);
        }
      });

      incomeData.push(mIncome);
      expenseData.push(mExpense);
    }

    if (this.analyticsBarChart) {
      this.analyticsBarChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.analyticsBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: colors.income,
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.65
          },
          {
            label: 'Spending',
            data: expenseData,
            backgroundColor: colors.expense,
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.65
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 12 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${store.getState().preferences.currency === 'INR' ? '₹' : '$'}${val >= 1000 ? (val / 1000) + 'k' : val}`
            }
          }
        }
      }
    });
  }

  // --- 6. Financial Analytics: Net Wealth & Cumulative Savings Trajectory ---
  renderAnalyticsLineChart(rangeMonths = (this.analyticsRange === '1y' ? 12 : 6)) {
    const canvas = document.getElementById('analyticsLineChartCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const state = store.getState();
    const transactions = state.transactions || [];
    const now = new Date();

    const months = [];
    const trajectoryData = [];
    let runningNet = 0;

    for (let i = rangeMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      months.push(monthLabel);

      let mIncome = 0;
      let mExpense = 0;

      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth()) {
          if (tx.type === 'income') mIncome += (Number(tx.amount) || 0);
          if (tx.type === 'expense') mExpense += (Number(tx.amount) || 0);
        }
      });

      runningNet += (mIncome - mExpense);
      trajectoryData.push(runningNet);
    }

    if (this.analyticsLineChart) {
      this.analyticsLineChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    this.analyticsLineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Cumulative Net Savings',
            data: trajectoryData,
            borderColor: '#10B981',
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10B981',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 12, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => ` Cumulative Savings: ${store.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Inter', size: 12 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${store.getState().preferences.currency === 'INR' ? '₹' : '$'}${val >= 1000 ? (val / 1000) + 'k' : val}`
            }
          }
        }
      }
    });
  }

  // --- 7. Financial Analytics: Expense Share by Category Donut ---
  renderAnalyticsDonutChart() {
    const canvas = document.getElementById('analyticsDonutCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const colors = this.getChartColors();
    const stats = store.getCurrentMonthStats();
    const spendMap = stats.categorySpendMap || {};

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(spendMap).forEach(([catId, amount]) => {
      if (amount > 0) {
        const cat = store.getCategoryById(catId);
        labels.push(cat.name);
        data.push(amount);
        bgColors.push(cat.color || '#6366F1');
      }
    });

    if (data.length === 0) {
      labels.push('No Expenses');
      data.push(1);
      bgColors.push(colors.grid);
    }

    if (this.analyticsDonutChart) {
      this.analyticsDonutChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.analyticsDonutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: bgColors,
            borderColor: this.isDarkMode() ? '#1E293B' : '#FFFFFF',
            borderWidth: 3,
            hoverOffset: 6,
            cutout: '70%'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { family: 'Inter', size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${store.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // --- 8. Financial Analytics: Category Spend Velocity & Burn Rates Table ---
  renderAnalyticsCategoryTable() {
    const tbody = document.getElementById('analyticsCategoryTableBody');
    if (!tbody) return;

    const state = store.getState();
    const stats = store.getCurrentMonthStats();
    const spendMap = stats.categorySpendMap || {};
    const totalExpenses = stats.totalExpenses || 1;

    // Count transactions per category in current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const txCountMap = {};

    (state.transactions || []).forEach(tx => {
      const d = new Date(tx.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && tx.type === 'expense') {
        txCountMap[tx.categoryId] = (txCountMap[tx.categoryId] || 0) + 1;
      }
    });

    const entries = Object.entries(spendMap)
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-muted">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="text-2xl">📊</span>
              <span class="text-sm font-medium">No expense records found for this period.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = entries.map(([catId, amount]) => {
      const cat = store.getCategoryById(catId);
      const pct = ((amount / totalExpenses) * 100).toFixed(1);
      const count = txCountMap[catId] || 1;
      const avg = Math.round(amount / count);

      return `
        <tr class="border-b border-border/40 hover:bg-surface-elevated/40 transition">
          <td class="py-3 px-2">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm" style="background-color: ${cat.color || '#6366F1'};">
                <i data-lucide="${cat.icon || 'tag'}" class="w-3.5 h-3.5"></i>
              </div>
              <div>
                <div class="font-bold text-foreground text-xs">${cat.name}</div>
                <div class="text-[10px] text-muted capitalize">${cat.type}</div>
              </div>
            </div>
          </td>
          <td class="py-3 font-mono font-bold text-foreground text-xs">
            ${store.formatCurrency(amount)}
          </td>
          <td class="py-3">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] font-semibold text-muted w-10">${pct}%</span>
              <div class="flex-1 max-w-[100px] h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${cat.color || '#6366F1'};"></div>
              </div>
            </div>
          </td>
          <td class="py-3 text-muted text-xs font-medium">
            <span class="badge badge-secondary text-[10px]">${count} txs</span>
          </td>
          <td class="py-3 text-right font-mono text-xs font-semibold text-foreground">
            ${store.formatCurrency(avg)}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- 9. Setup Analytics Range Toggle Controls ---
  setupAnalyticsControls() {
    const btn6M = document.getElementById('analyticsRange6M');
    const btn1Y = document.getElementById('analyticsRange1Y');

    if (btn6M && !btn6M._listenerAttached) {
      btn6M._listenerAttached = true;
      btn6M.addEventListener('click', () => {
        this.analyticsRange = '6m';
        btn6M.classList.add('active');
        if (btn1Y) btn1Y.classList.remove('active');
        this.renderAnalyticsBarChart(6);
        this.renderAnalyticsLineChart(6);
        if (window.audio) window.audio.playClick?.();
      });
    }

    if (btn1Y && !btn1Y._listenerAttached) {
      btn1Y._listenerAttached = true;
      btn1Y.addEventListener('click', () => {
        this.analyticsRange = '1y';
        btn1Y.classList.add('active');
        if (btn6M) btn6M.classList.remove('active');
        this.renderAnalyticsBarChart(12);
        this.renderAnalyticsLineChart(12);
        if (window.audio) window.audio.playClick?.();
      });
    }
  }
}

export const chartManager = new ChartManager();
