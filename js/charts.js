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
  }

  isDarkMode() {
    return store.getState().preferences.theme === 'dark';
  }

  getChartColors() {
    const isDark = this.isDarkMode();
    return {
      text: isDark ? '#94A3B8' : '#475569',
      heading: isDark ? '#F1F5F9' : '#0F172A',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
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
}

export const chartManager = new ChartManager();
