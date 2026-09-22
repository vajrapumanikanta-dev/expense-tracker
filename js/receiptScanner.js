/**
 * Smart Receipt Scanner (OCR Simulation)
 * Provides drag-and-drop receipt upload, preview, and intelligent parsing to auto-populate transactions.
 */

import { store } from './store.js';
import { audio } from './audio.js';

class ReceiptScanner {
  constructor() {
    this.currentExtracted = null;
  }

  // Pre-configured mock templates for quick testing
  getSampleReceipts() {
    return [
      {
        merchant: 'Trader Joe’s Market',
        amount: 54.75,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_groceries',
        notes: 'Organic groceries, fruits & bakery items',
        tags: ['groceries', 'receipt-scan']
      },
      {
        merchant: 'Apple Store Regent St',
        amount: 179.00,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_shopping',
        notes: 'AirPods Pro replacement & MagSafe adapter',
        tags: ['gadgets', 'apple']
      },
      {
        merchant: 'Chipotle Mexican Grill',
        amount: 23.40,
        date: new Date().toISOString().split('T')[0],
        categoryId: 'cat_food',
        notes: 'Burrito bowls & guacamole with drinks',
        tags: ['dining', 'fast-casual']
      }
    ];
  }

  initDropzone() {
    const dropzone = document.getElementById('receiptDropzone');
    const fileInput = document.getElementById('receiptFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-500/10');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processFile(e.target.files[0]);
      }
    });
  }

  processFile(file) {
    const scanStatus = document.getElementById('receiptScanStatus');
    const scanResult = document.getElementById('receiptScanResult');
    if (!scanStatus || !scanResult) return;

    scanStatus.classList.remove('hidden');
    scanResult.classList.add('hidden');
    scanStatus.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-center">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm font-semibold text-foreground">AI OCR Scanner analyzing receipt image...</p>
        <p class="text-xs text-muted mt-1">Extracting merchant, totals, tax, and categorization</p>
      </div>
    `;

    setTimeout(() => {
      // Pick or simulate extracted receipt details
      const samples = this.getSampleReceipts();
      const extracted = samples[Math.floor(Math.random() * samples.length)];
      this.currentExtracted = extracted;

      audio.playSuccess();
      scanStatus.classList.add('hidden');
      scanResult.classList.remove('hidden');

      const cat = store.getCategoryById(extracted.categoryId);
      scanResult.innerHTML = `
        <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <span class="badge badge-emerald text-xs font-bold">✓ OCR Extracted Successfully</span>
            <span class="text-xs text-muted font-mono">${file.name}</span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm pt-2">
            <div>
              <span class="text-xs text-muted block">Merchant</span>
              <span class="font-bold text-foreground">${extracted.merchant}</span>
            </div>
            <div>
              <span class="text-xs text-muted block">Total Detected</span>
              <span class="font-black text-emerald-400 text-base">${store.formatCurrency(extracted.amount)}</span>
            </div>
            <div>
              <span class="text-xs text-muted block">Suggested Category</span>
              <span class="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></span>
                ${cat.name}
              </span>
            </div>
            <div>
              <span class="text-xs text-muted block">Date</span>
              <span class="font-medium text-foreground">${extracted.date}</span>
            </div>
          </div>

          <div class="pt-3 border-t border-border/40 flex justify-end gap-2">
            <button class="btn btn-primary btn-sm w-full" onclick="window.receiptScanner.applyExtracted()">
              <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Pre-fill & Create Transaction
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }, 1200);
  }

  loadSample(index) {
    const samples = this.getSampleReceipts();
    const sample = samples[index] || samples[0];
    this.currentExtracted = sample;
    this.applyExtracted();
  }

  applyExtracted() {
    if (!this.currentExtracted) return;
    window.app.closeAllModals();
    window.app.openTransactionModal({
      type: 'expense',
      merchant: this.currentExtracted.merchant,
      description: this.currentExtracted.merchant,
      amount: this.currentExtracted.amount,
      categoryId: this.currentExtracted.categoryId,
      date: this.currentExtracted.date,
      notes: this.currentExtracted.notes,
      tags: this.currentExtracted.tags
    });
  }
}

export const receiptScanner = new ReceiptScanner();
window.receiptScanner = receiptScanner;
