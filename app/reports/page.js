"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import { exportToExcel } from "@/lib/exportToExcel";
import {
  syncMasterGoogleSheet,
  initializeSheetStructure,
  getMasterSheetUrl,
  getWebhookUrl,
  saveSheetConfig,
} from "@/google_sheets_sync/syncClient";
import {
  calculateLiveInventory,
  getStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import { DEFAULT_SUPPLIERS } from "@/data/defaultSuppliers";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "@/components/ui/ui.css";
import "./reports.css";

export default function ReportsPage() {
  const [data, setData] = useState({
    inventory: [],
    suppliers: DEFAULT_SUPPLIERS,
    purchases: [],
    issues: [],
    consumptions: [],
    bills: [],
    needed: [],
    payments: [],
    returns: [],
  });

  const [activeCategory, setActiveCategory] = useState("all"); // 'all' | 'inventory' | 'procurement' | 'operations' | 'finance'
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ type: "", message: "", details: null });
  const [sheetUrl, setSheetUrl] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");
  const [sheetUrlInput, setSheetUrlInput] = useState("");



  useEffect(() => {
    const rawSuppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);

    setData({
      inventory: calculateLiveInventory(),
      suppliers: rawSuppliers,
      purchases: getStorageData(STORAGE_KEYS.PURCHASES, []),
      issues: getStorageData(STORAGE_KEYS.ISSUES, []),
      consumptions: getStorageData(STORAGE_KEYS.CONSUMPTIONS, []),
      bills: getStorageData(STORAGE_KEYS.BILLS, []),
      needed: getStorageData(STORAGE_KEYS.NEEDED, []),
      payments: getStorageData(STORAGE_KEYS.PAYMENTS, []),
      returns: getStorageData(STORAGE_KEYS.RETURNS, []),
    });

    const currentSheet = getMasterSheetUrl();
    setSheetUrl(currentSheet);
    setSheetUrlInput(currentSheet);
    setWebhookInput(getWebhookUrl());
  }, []);

  useEffect(() => {
    if (isConfigOpen) {
      lockScroll();
    }
    return () => {
      if (isConfigOpen) unlockScroll();
    };
  }, [isConfigOpen]);

  const handleSyncMaster = async (mode = "upsert") => {
    setSyncLoading(true);
    setSyncStatus({
      type: "info",
      message: "Synchronizing Admin Master Sheet with duplicate prevention (in-place upsert)... All module & supplier data will be uploaded to the Master Sheet.",
    });
    try {
      const res = await syncMasterGoogleSheet({ mode });
      const added = res.totalAdded || 0;
      const updated = res.totalUpdated || 0;
      const dur = res.duration || "completed";
      const countMsg = res.totalReceived !== undefined
        ? `Processed ${res.totalReceived} records (${added} new inserted, ${updated} in-place updated, 0 duplicates)`
        : `Synchronized ${res.summary ? Object.keys(res.summary).length : 10} modules to Master Sheet`;

      setSyncStatus({
        type: "success",
        message: `✓ Admin Master Sheet Synced! ${countMsg} in ${dur}. All supplier and company data is safely consolidated in the Master Sheet (independent of individual supplier links).`,
        details: res.summary,
      });
      setSheetUrl(getMasterSheetUrl());
    } catch (err) {
      setSyncStatus({
        type: "error",
        message: `Master sync failed: ${err.message}`,
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleInitializeMaster = async () => {
    setSyncLoading(true);
    setSyncStatus({ type: "info", message: "Initializing and formatting Admin Master Sheet structure..." });
    try {
      await initializeSheetStructure(sheetUrl, "ADMIN");
      setSyncStatus({
        type: "success",
        message: "✓ Admin Master Sheet tabs, dark slate headers, and KPI Dashboard formatted successfully.",
      });
    } catch (err) {
      setSyncStatus({ type: "error", message: `Initialization failed: ${err.message}` });
    } finally {
      setSyncLoading(false);
    }
  };



  const handleSaveConfig = (e) => {
    e.preventDefault();
    saveSheetConfig({ webhookUrl: webhookInput, sheetUrl: sheetUrlInput });
    setSheetUrl(sheetUrlInput);
    setIsConfigOpen(false);
    setSyncStatus({ type: "success", message: "Google Sheets connection configuration saved." });
  };

  // Report Definitions across 4 categories
  const reportCards = [
    // 1. INVENTORY
    {
      id: "inv-stock",
      category: "inventory",
      categoryLabel: "Inventory",
      title: "Current Stock Summary",
      desc: "Live available inventory stock and unit valuations.",
      count: data.inventory.length,
      icon: "📦",
      onExport: () =>
        exportToExcel({
          filename: "Stock_Summary_Report",
          headers: ["Material", "Category", "Available Stock", "Unit", "Rate", "Valuation", "Status"],
          rows: data.inventory.map((i) => [i.name, i.category, i.availableStock, i.unit, i.rate, i.stockValue, i.status]),
        }),
    },
    {
      id: "inv-low",
      category: "inventory",
      categoryLabel: "Inventory",
      title: "Low & Critical Stock Items",
      desc: "Materials below safety threshold requiring procurement replenishment.",
      count: data.inventory.filter((i) => i.status === "Low" || i.status === "Critical").length,
      icon: "⚠️",
      onExport: () =>
        exportToExcel({
          filename: "Low_Stock_Action_Report",
          headers: ["Material", "Category", "Available Stock", "Unit", "Status"],
          rows: data.inventory
            .filter((i) => i.status === "Low" || i.status === "Critical")
            .map((i) => [i.name, i.category, i.availableStock, i.unit, i.status]),
        }),
    },

    // 2. PROCUREMENT
    {
      id: "proc-purchases",
      category: "procurement",
      categoryLabel: "Procurement",
      title: "Purchase Orders & PI Report",
      desc: "All inward vendor purchases, quotation references, and invoice amounts.",
      count: data.purchases.length,
      icon: "▣",
      onExport: () =>
        exportToExcel({
          filename: "Purchases_PI_Report",
          headers: ["PI Number", "Date", "Supplier", "Quote #", "Items Count", "Total Amount", "Status"],
          rows: data.purchases.map((p) => [
            p.piNumber || (Array.isArray(p) ? p[0] : "—"),
            p.piDate || (Array.isArray(p) ? p[1] : "—"),
            p.supplier || (Array.isArray(p) ? p[2] : "—"),
            p.quotationNumber || (Array.isArray(p) ? p[3] : "—"),
            p.itemsCount || 1,
            p.totalAmount || (Array.isArray(p) ? p[5] : "—"),
            p.status || "Approved",
          ]),
        }),
    },
    {
      id: "proc-suppliers",
      category: "procurement",
      categoryLabel: "Procurement",
      title: "Suppliers Directory",
      desc: "Active and approved suppliers with GSTIN and contact details.",
      count: data.suppliers.length,
      icon: "🏢",
      onExport: () =>
        exportToExcel({
          filename: "Suppliers_Directory_Report",
          headers: ["Code", "Name", "Contact Person", "Phone", "Email", "GSTIN", "Status"],
          rows: data.suppliers,
        }),
    },

    // 3. OPERATIONS
    {
      id: "ops-issues",
      category: "operations",
      categoryLabel: "Operations",
      title: "Material Issue & Dispatches",
      desc: "Challans and materials dispatched to contractors, departments, and sites.",
      count: data.issues.length,
      icon: "↗",
      onExport: () =>
        exportToExcel({
          filename: "Material_Issues_Report",
          headers: ["Challan #", "Date", "Issued To / Site", "Items Count", "Status"],
          rows: data.issues.map((i) => [i.number, i.date, i.department, i.itemsCount, i.status]),
        }),
    },
    {
      id: "ops-consumption",
      category: "operations",
      categoryLabel: "Operations",
      title: "Site Material Consumption",
      desc: "Actual physical consumption recorded at project sites.",
      count: data.consumptions.length,
      icon: "◔",
      onExport: () =>
        exportToExcel({
          filename: "Material_Consumption_Report",
          headers: ["Consumption #", "Date", "Site", "Items Count", "Status"],
          rows: data.consumptions.map((c) => [c.number, c.date, c.department, c.itemsCount, c.status]),
        }),
    },
    {
      id: "ops-needed",
      category: "operations",
      categoryLabel: "Operations",
      title: "Site Requisitions & Demand",
      desc: "Active site requirements, required dates, and priorities.",
      count: data.needed.length,
      icon: "📋",
      onExport: () =>
        exportToExcel({
          filename: "Material_Requisitions_Report",
          headers: ["Site / Party", "Material", "Qty Needed", "Unit", "Required Date", "Priority", "Status"],
          rows: data.needed.map((n) => [
            n.partyName,
            n.materialName,
            n.quantityNeeded,
            n.unit,
            n.requiredByDate,
            n.priority,
            n.status,
          ]),
        }),
    },
    {
      id: "ops-returns",
      category: "operations",
      categoryLabel: "Operations",
      title: "Returns & Movement Log",
      desc: "Site returns to warehouse, inter-site transfers, and scrap records.",
      count: data.returns.length,
      icon: "⇄",
      onExport: () =>
        exportToExcel({
          filename: "Returns_and_Transfers_Report",
          headers: ["Voucher #", "Type", "Date", "Source", "Destination", "Material", "Qty", "Reason"],
          rows: data.returns.map((r) => [
            r.returnNo,
            r.movementType,
            r.date,
            r.sourceSite,
            r.destinationSite,
            r.materialName,
            `${r.quantity} ${r.unit}`,
            r.reason,
          ]),
        }),
    },

    // 4. FINANCE
    {
      id: "fin-payments",
      category: "finance",
      categoryLabel: "Finance",
      title: "Party & Vendor Payment Ledger",
      desc: "Invoiced amounts, payment receipts, balance due, and modes.",
      count: data.payments.length,
      icon: "💰",
      onExport: () =>
        exportToExcel({
          filename: "Payment_Ledger_Statement",
          headers: ["Party / Vendor", "Invoice #", "Date", "Total Billed (₹)", "Amount Paid (₹)", "Balance Left (₹)", "Payment Mode", "Status"],
          rows: data.payments.map((p) => [
            p.partyName,
            p.invoiceNo,
            p.invoiceDate,
            p.totalAmount,
            p.amountPaid,
            p.balanceLeft,
            p.paymentMode,
            p.status,
          ]),
        }),
    },
    {
      id: "fin-bills",
      category: "finance",
      categoryLabel: "Finance",
      title: "Attached Bills & Invoices Vault",
      desc: "Soft copies of Tax Invoices and Proforma Invoices with audit log.",
      count: data.bills.length,
      icon: "🧾",
      onExport: () =>
        exportToExcel({
          filename: "Bills_Vault_Register",
          headers: ["Type", "Number", "Supplier", "Date", "Amount", "File Name"],
          rows: data.bills.map((b) => [b.billType, b.billNumber, b.supplierName, b.billDate, b.amount, b.fileName]),
        }),
    },
  ];

  const filteredReports = activeCategory === "all"
    ? reportCards
    : reportCards.filter((r) => r.category === activeCategory);

  return (
    <Shell>
      <Title
        title="Reports & Cloud Sync Hub"
        desc="Generate operational reports, download Excel spreadsheets, and synchronize live with Google Sheets."
      />

      {/* 1. Admin Master Google Sheets Sync Card */}
      <section className="card syncHubCard">
        <div className="syncHubRow">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "16px", margin: 0 }}>Admin Master Google Sheet</h2>
              <span className="liveBadge">Connected</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
            >
              ⚙ Connection Settings
            </button>
            <button
              type="button"
              className="secondary"
              disabled={syncLoading}
              onClick={handleInitializeMaster}
              title="Ensure all 10 module tabs, frozen headers, and KPI Dashboard exist"
            >
              🛠 Repair Structure
            </button>
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary"
              style={{ textDecoration: "none" }}
            >
              ↗ Open Master Sheet
            </a>
            <button
              type="button"
              className="primary"
              disabled={syncLoading}
              onClick={() => handleSyncMaster("upsert")}
            >
              {syncLoading ? "Syncing..." : "⚡ Sync Master Sheet (Upsert)"}
            </button>
          </div>
        </div>

        {/* Webhook & Sheet Config Form */}
        {isConfigOpen && (
          <form
            onSubmit={handleSaveConfig}
            className="webhookConfigForm animate-fade-in"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "var(--bg-card)",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              marginTop: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", flex: "1 1 320px" }}>
                Google Apps Script Webhook URL:
                <input
                  type="url"
                  required
                  placeholder="https://script.google.com/macros/s/.../exec"
                  style={{ marginTop: "4px", width: "100%" }}
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
                  The Web App URL generated when deploying your Apps Script (ends in /exec).
                </span>
              </label>

              <label style={{ fontSize: "12px", fontWeight: "600", flex: "1 1 320px" }}>
                Admin Master Spreadsheet URL:
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  style={{ marginTop: "4px", width: "100%" }}
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
                  The link to your consolidated Admin Master Google Spreadsheet.
                </span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" className="secondary" onClick={() => setIsConfigOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Save Settings
              </button>
            </div>
          </form>
        )}

        {/* Sync Status Alert */}
        {syncStatus.message && (
          <div className={`syncStatusAlert ${syncStatus.type}`}>
            {syncStatus.message}
          </div>
        )}
      </section>

      </section>


      {/* Report Categories Filter Tabs */}
      <div className="reportCategoryTabs">
        <button
          type="button"
          className={`reportCatTab ${activeCategory === "all" ? "active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          All Reports ({reportCards.length})
        </button>
        <button
          type="button"
          className={`reportCatTab ${activeCategory === "inventory" ? "active" : ""}`}
          onClick={() => setActiveCategory("inventory")}
        >
          📦 Inventory ({reportCards.filter((r) => r.category === "inventory").length})
        </button>
        <button
          type="button"
          className={`reportCatTab ${activeCategory === "procurement" ? "active" : ""}`}
          onClick={() => setActiveCategory("procurement")}
        >
          🛒 Procurement ({reportCards.filter((r) => r.category === "procurement").length})
        </button>
        <button
          type="button"
          className={`reportCatTab ${activeCategory === "operations" ? "active" : ""}`}
          onClick={() => setActiveCategory("operations")}
        >
          🏗 Operations ({reportCards.filter((r) => r.category === "operations").length})
        </button>
        <button
          type="button"
          className={`reportCatTab ${activeCategory === "finance" ? "active" : ""}`}
          onClick={() => setActiveCategory("finance")}
        >
          💰 Finance & Ledger ({reportCards.filter((r) => r.category === "finance").length})
        </button>
      </div>

      {/* Reports Grid */}
      <div className="reportsGrid">
        {filteredReports.map((r) => (
          <div key={r.id} className="card reportCard">
            <div>
              <div className="reportCardTop">
                <span className="reportIcon">{r.icon}</span>
                <span className="reportCatBadge">{r.categoryLabel}</span>
              </div>
              <h3 className="reportTitle">{r.title}</h3>
              <p className="reportDesc">{r.desc}</p>
            </div>

            <div className="reportCardBottom">
              <span className="recordCount">{r.count} Records</span>
              <button
                type="button"
                className={`btn btn-sm ${r.count > 0 ? "btn-primary" : "btn-secondary"}`}
                onClick={r.onExport}
              >
                ⤓ Download Excel (.csv)
              </button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
