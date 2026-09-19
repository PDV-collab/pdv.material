"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { Title } from "@/components/ui/Title";
import { Badge } from "@/components/ui/Badge";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
} from "@/lib/dataService";
import "@/components/ui/ui.css";
import "./consumption.css";

export default function ConsumptionForm() {
  const [issuesList, setIssuesList] = useState([]);
  const [consumptionsList, setConsumptionsList] = useState([]);
  const [selectedVoucherNo, setSelectedVoucherNo] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const [consumptionNo, setConsumptionNo] = useState(
    `MC-${Date.now().toString().slice(-4)}`
  );
  const [consumptionDate, setConsumptionDate] = useState(todayStr);
  const [usedBy, setUsedBy] = useState("Rajesh (Site Supervisor)");
  const [remarks, setRemarks] = useState("");

  // Material rows with entered consumed quantity: [{ name, unit, issuedQty, previouslyConsumed, balance, usedNow }]
  const [materialRows, setMaterialRows] = useState([]);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const issues = getStorageData(STORAGE_KEYS.ISSUES, []);
    const consumptions = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
    setIssuesList(issues);
    setConsumptionsList(consumptions);

    if (issues.length > 0 && !selectedVoucherNo) {
      const first = issues[0];
      setSelectedVoucherNo(first.number || first.challanNo);
      loadIssueMaterials(first, consumptions);
    }
  }, []);

  const loadIssueMaterials = (issue, allConsumptions) => {
    setSelectedIssue(issue);
    if (!issue) return;

    // Get previous consumptions for this voucher
    const voucherNo = issue.number || issue.challanNo;
    const priorConsumptions = allConsumptions.filter(
      (c) => c.issueVoucher === voucherNo || c.number === voucherNo
    );

    // Calculate per-material prior usage
    const priorUsageMap = {};
    priorConsumptions.forEach((c) => {
      if (c.items && Array.isArray(c.items)) {
        c.items.forEach((item) => {
          const key = (item.name || "").toLowerCase();
          priorUsageMap[key] = (priorUsageMap[key] || 0) + (Number(item.qty || item.quantityUsed) || 0);
        });
      }
    });

    // Build rows from issue items
    const rawItems = issue.items || [
      { name: 'GI Pipe 1/2"', quantity: 50, unit: "Mtr" },
      { name: "Isolation Valve 1/2\"", quantity: 10, unit: "Nos" },
      { name: "Hose Clamp", quantity: 20, unit: "Pcs" },
    ];

    const rows = rawItems.map((item) => {
      const name = item.name || item.materialName;
      const unit = item.unit || "Pcs";
      const issuedQty = Number(item.quantity || item.qty) || 0;
      const prevUsed = priorUsageMap[name.toLowerCase()] || 0;
      const balance = Math.max(0, issuedQty - prevUsed);

      return {
        name,
        unit,
        issuedQty,
        previouslyConsumed: prevUsed,
        balance,
        usedNow: balance > 0 ? Math.min(balance, 5) : 0,
      };
    });

    setMaterialRows(rows);
  };

  const handleVoucherSelect = (vNo) => {
    setSelectedVoucherNo(vNo);
    const found = issuesList.find((i) => (i.number || i.challanNo) === vNo);
    if (found) {
      loadIssueMaterials(found, consumptionsList);
    }
  };

  const handleQtyChange = (index, val) => {
    const copy = [...materialRows];
    copy[index].usedNow = Number(val) || 0;
    setMaterialRows(copy);
  };

  const handleSaveConsumption = (e) => {
    e.preventDefault();

    // Filter items with actual usage > 0
    const activeItems = materialRows.filter((r) => r.usedNow > 0);
    if (activeItems.length === 0) {
      alert("Please enter a consumed quantity (> 0) for at least one material.");
      return;
    }

    // Validate that no item exceeds available balance
    for (const item of activeItems) {
      if (item.usedNow > item.balance) {
        alert(
          `Usage for "${item.name}" (${item.usedNow}) cannot exceed available issued balance (${item.balance}).`
        );
        return;
      }
    }

    const newRecord = {
      number: consumptionNo,
      date: consumptionDate,
      department: selectedIssue?.department || "Site",
      site: selectedIssue?.site || selectedIssue?.department,
      issueVoucher: selectedVoucherNo,
      itemsCount: activeItems.length,
      status: "Consumed",
      usedBy,
      remarks,
      items: activeItems.map((item) => ({
        name: item.name,
        quantityUsed: item.usedNow,
        unit: item.unit,
        usedBy,
      })),
    };

    const current = getStorageData(STORAGE_KEYS.CONSUMPTIONS, []);
    const updated = [newRecord, ...current];
    setStorageData(STORAGE_KEYS.CONSUMPTIONS, updated);
    setConsumptionsList(updated);

    setMessage(
      `✓ Consumption ${consumptionNo} recorded for ${selectedIssue?.department}! Remaining site balances updated.`
    );
    setReloadKey((prev) => prev + 1);

    // Refresh rows
    if (selectedIssue) {
      loadIssueMaterials(selectedIssue, updated);
    }

    // Reset inputs
    setTimeout(() => {
      setMessage("");
      setConsumptionNo(`MC-${Date.now().toString().slice(-4)}`);
    }, 3000);
  };

  const voucherOptions = issuesList.map((iss) => {
    const site = iss.department || iss.issuedTo || "Site Destination";
    const dt = iss.date || "Recent";
    const count = iss.itemsCount || (iss.items ? iss.items.length : 1);
    return {
      value: iss.number || iss.challanNo,
      label: `📍 ${site} (Dispatched: ${dt})`,
      sublabel: `${count} item${count === 1 ? "" : "s"} issued · Available for consumption`,
    };
  });

  return (
    <Shell>
      <Title
        title="Record Material Consumption"
        desc="Select an issued site dispatch to automatically populate issued materials and record actual usage."
      />

      {message && <div className="consumptionSuccessBanner animate-fade-in">{message}</div>}

      <form onSubmit={handleSaveConsumption}>
        {/* Section 1: Voucher Selection */}
        <section className="card formCard">
          <div className="sectionHead">
            <div>
              <h2>1. Select Site Dispatch Batch</h2>
              <p>The system will automatically load the materials and quantities that were dispatched to that site.</p>
            </div>
          </div>

          <div className="formGrid">
            <div style={{ gridColumn: "1 / -1" }}>
              <SearchableSelect
                label="Select Site Dispatch Batch *"
                required
                options={voucherOptions}
                value={selectedVoucherNo}
                onChange={handleVoucherSelect}
                placeholder="Choose from active site dispatches..."
              />
            </div>

            <label>
              Consumption Date *
              <input
                type="date"
                required
                value={consumptionDate}
                onChange={(e) => setConsumptionDate(e.target.value)}
              />
            </label>

            <label>
              Used By / Field Supervisor *
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Kumar"
                value={usedBy}
                onChange={(e) => setUsedBy(e.target.value)}
              />
            </label>

            <label>
              Work Purpose / Remarks
              <input
                type="text"
                placeholder="e.g. Pipeline joint installation, maintenance..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Section 2: Auto-Loaded Issued Materials Matrix */}
        <section className="card formCard" style={{ marginTop: "20px" }}>
          <div className="sectionHead">
            <div>
              <h2>2. Issued Materials & Consumed Quantities ({materialRows.length})</h2>
              <p>Only enter what has actually been utilized. Unused quantities remain available at the site.</p>
            </div>
          </div>

          {/* 1. Mobile Consumption Cards (Zero Horizontal Scroll on <= 768px) */}
          <div className="mobileConsumeList">
            {materialRows.length === 0 ? (
              <div className="emptyTable">
                <p>No materials found for the selected voucher. Please select an issue voucher above.</p>
              </div>
            ) : (
              materialRows.map((row, idx) => {
                const balanceAfter = row.balance - row.usedNow;
                const isOver = row.usedNow > row.balance;

                return (
                  <div key={idx} className={`consumeItemCard ${isOver ? "overdraft" : ""}`}>
                    <div className="consumeCardHeader">
                      <h4 className="consumeCardTitle">{row.name}</h4>
                      <Badge variant={balanceAfter > 0 ? "success" : "neutral"}>
                        {balanceAfter > 0 ? "Active Site Balance" : "Depleted"}
                      </Badge>
                    </div>

                    <div className="consumeMetricRow">
                      <div className="consumeMetricCol">
                        <span className="consumeMetricLabel">Total Issued</span>
                        <strong className="consumeMetricVal">{row.issuedQty} {row.unit}</strong>
                      </div>
                      <div className="consumeMetricCol">
                        <span className="consumeMetricLabel">Prev Consumed</span>
                        <strong className="consumeMetricVal">{row.previouslyConsumed} {row.unit}</strong>
                      </div>
                      <div className="consumeMetricCol">
                        <span className="consumeMetricLabel">Available Site</span>
                        <strong className="consumeMetricVal" style={{ color: "var(--brand-600)" }}>
                          {row.balance} {row.unit}
                        </strong>
                      </div>
                    </div>

                    <div className="consumeInputRow">
                      <span className="consumeInputLabel">Actual Used Now:</span>
                      <div className="consumeStepperControls">
                        <button
                          type="button"
                          className="stepperBtn"
                          onClick={() => handleQtyChange(idx, Math.max(0, row.usedNow - 1))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={row.balance}
                          className="stepperInput"
                          value={row.usedNow}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                        />
                        <button
                          type="button"
                          className="stepperBtn"
                          onClick={() => handleQtyChange(idx, Math.min(row.balance, row.usedNow + 1))}
                        >
                          +
                        </button>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "2px" }}>
                          {row.unit}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px", paddingTop: "4px", borderTop: "1px solid var(--border-subtle)" }}>
                      <span style={{ color: "var(--text-muted)" }}>Remaining Balance After:</span>
                      <strong style={{ color: isOver ? "#dc2626" : balanceAfter === 0 ? "var(--text-muted)" : "#059669" }}>
                        {balanceAfter} {row.unit}
                      </strong>
                    </div>

                    {isOver && (
                      <div style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "4px", fontSize: "11.5px", fontWeight: 700 }}>
                        ⚠️ Used quantity cannot exceed available site balance ({row.balance} {row.unit})
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 2. Desktop Consumption Table (Visible on > 768px) */}
          <div className="tableScroll">
            <table className="consumptionTable">
              <thead>
                <tr>
                  <th>Material Description</th>
                  <th>Total Issued</th>
                  <th>Previously Consumed</th>
                  <th>Available Balance</th>
                  <th style={{ width: "160px" }}>Actual Used Now</th>
                  <th>Remaining After</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="emptyTable">
                      <p>No materials found for the selected voucher. Please choose an issue voucher above.</p>
                    </td>
                  </tr>
                ) : (
                  materialRows.map((row, idx) => {
                    const balanceAfter = row.balance - row.usedNow;
                    const isOver = row.usedNow > row.balance;

                    return (
                      <tr key={idx} className={isOver ? "overdraftRow" : ""}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.issuedQty} {row.unit}</td>
                        <td>{row.previouslyConsumed} {row.unit}</td>
                        <td>
                          <b style={{ color: "var(--brand-700)" }}>{row.balance}</b> {row.unit}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input
                              type="number"
                              min="0"
                              max={row.balance}
                              style={{ width: "90px", height: "36px", fontWeight: "700" }}
                              value={row.usedNow}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                            />
                            <span>{row.unit}</span>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: isOver ? "#dc2626" : balanceAfter === 0 ? "var(--text-muted)" : "#059669" }}>
                            {balanceAfter} {row.unit}
                          </strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="stepFooter" style={{ marginTop: "20px" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", minHeight: "44px" }}>
              ✓ Save Consumption Record
            </button>
          </div>
        </section>
      </form>
    </Shell>
  );
}
