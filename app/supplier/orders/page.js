"use client";

import { useState, useEffect, useMemo } from "react";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getStorageData,
  setStorageData,
  STORAGE_KEYS,
  calculateLiveInventory,
} from "@/lib/dataService";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import "../supplier.css";

export default function SupplierOrdersPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [selectedPo, setSelectedPo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState("");
  const [materialCatalog, setMaterialCatalog] = useState([]);

  const todayStr = new Date().toISOString().split("T")[0];
  const [orderForm, setOrderForm] = useState({
    orderNumber: `SO-${Math.floor(1000 + Math.random() * 9000)}`,
    orderDate: todayStr,
    location: "Central Warehouse",
    quotationNumber: `QT-${Date.now().toString().slice(-3)}`,
    remarks: "",
  });

  const [lineItems, setLineItems] = useState([
    {
      materialName: "GI Pipe 1/2\"",
      unit: "Mtr",
      quantity: 50,
      rate: 150,
      total: 7500,
    },
  ]);

  useEffect(() => {
    // Load live inventory items set by Admin in inventory/product master
    const inventoryItems = calculateLiveInventory();
    const catalog = inventoryItems.map((item) => ({
      name: item.name,
      unit: item.unit || "Pcs",
      rate: Number(item.rate) || 120, // Admin fixed rate
      category: item.category || "General",
    }));
    setMaterialCatalog(catalog);

    // Check if opened with ?action=new query param
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }

    async function loadOrders() {
      setIsLoading(true);
      try {
        const clientPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
        const res = await fetch("/api/supplier/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchases: clientPurchases }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setPurchases(json.data.purchases || []);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [user]);

  useEffect(() => {
    if (isCreateModalOpen) {
      lockScroll();
    }
    return () => {
      if (isCreateModalOpen) unlockScroll();
    };
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (selectedPo) {
      lockScroll();
    }
    return () => {
      if (selectedPo) unlockScroll();
    };
  }, [selectedPo]);

  const handleOpenCreateModal = () => {
    const defaultMat = materialCatalog[0] || { name: "GI Pipe 1/2\"", unit: "Mtr", rate: 150 };
    const fixedRate = Number(defaultMat.rate) || 120;
    setOrderForm({
      orderNumber: `SO-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: todayStr,
      location: "Central Warehouse",
      quotationNumber: `QT-${Date.now().toString().slice(-3)}`,
      remarks: "",
    });
    setLineItems([
      {
        materialName: defaultMat.name,
        unit: defaultMat.unit || "Mtr",
        quantity: 50,
        rate: fixedRate,
        total: 50 * fixedRate,
      },
    ]);
    setIsCreateModalOpen(true);
  };

  const handleAddLineItem = () => {
    const defaultMat = materialCatalog[0] || { name: "GI Pipe 1/2\"", unit: "Mtr", rate: 150 };
    const fixedRate = Number(defaultMat.rate) || 120;
    setLineItems([
      ...lineItems,
      {
        materialName: defaultMat.name,
        unit: defaultMat.unit || "Mtr",
        quantity: 10,
        rate: fixedRate,
        total: 10 * fixedRate,
      },
    ]);
  };

  const handleRemoveLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index, field, value) => {
    const copy = [...lineItems];

    if (field === "materialName") {
      copy[index].materialName = value;
      // When product is selected, price and unit are strictly locked to admin inventory rate
      const found = materialCatalog.find((m) => m.name === value);
      if (found) {
        copy[index].unit = found.unit || "Pcs";
        copy[index].rate = Number(found.rate) || 120;
      }
    } else if (field === "quantity") {
      copy[index].quantity = Math.max(1, Number(value) || 1);
    }

    // Rate cannot be modified by supplier; total is strictly quantity * fixedRate
    const qty = Number(copy[index].quantity) || 1;
    const fixedRate = Number(copy[index].rate) || 0;
    copy[index].total = Math.round(qty * fixedRate);

    setLineItems(copy);
  };

  const orderGrandTotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  }, [lineItems]);

  const handleSubmitOrder = (e) => {
    e.preventDefault();

    const supplierName = user?.supplierName || "Vasu Enterprises";
    const supplierCode = user?.supplierCode || "SUP-001";

    const newOrder = {
      piNumber: orderForm.orderNumber,
      piDate: orderForm.orderDate,
      supplier: supplierName,
      supplierCode: supplierCode,
      location: orderForm.location || "Central Warehouse",
      quotationNumber: orderForm.quotationNumber || "—",
      itemsCount: lineItems.length,
      totalAmount: `₹ ${orderGrandTotal.toLocaleString()}`,
      status: "Pending", // Visible in Admin Console as Pending
      deliveryStatus: "Pending",
      origin: "Supplier Portal",
      remarks: orderForm.remarks,
      lineItems: lineItems,
      createdAt: new Date().toISOString(),
    };

    // Save into centralized PURCHASES store
    const allPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
    const updated = [newOrder, ...allPurchases];
    setStorageData(STORAGE_KEYS.PURCHASES, updated);

    // Update local state
    setPurchases((prev) => [newOrder, ...prev]);
    setIsCreateModalOpen(false);

    setOrderSuccessMsg(
      `✓ Order [${newOrder.piNumber}] placed successfully for ₹ ${orderGrandTotal.toLocaleString()}! It has been reflected in the Admin Purchases Master and is pending operational review.`
    );
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const no = p.piNumber || (Array.isArray(p) ? p[0] : "");
      const quote = p.quotationNumber || (Array.isArray(p) ? p[3] : "");
      const stat = p.status || (Array.isArray(p) ? p[6] : "Approved");
      const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

      const matchesSearch =
        !search ||
        String(no).toLowerCase().includes(search.toLowerCase()) ||
        String(quote).toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || String(stat).toLowerCase() === statusFilter.toLowerCase();
      const matchesDelivery =
        deliveryFilter === "All" || String(deliv).toLowerCase() === deliveryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesDelivery;
    });
  }, [purchases, search, statusFilter, deliveryFilter]);

  return (
    <Shell>
      {/* Title Row */}
      <div className="sectionHeaderRow" style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)" }}>
            Supplier Purchase Orders
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
            Review official purchase orders, quotation references, and place new supply orders directly to PDV Operations.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
          >
            + Place New Supply Order
          </button>
        </div>
      </div>

      {orderSuccessMsg && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{orderSuccessMsg}</span>
          <button
            type="button"
            onClick={() => setOrderSuccessMsg("")}
            style={{ background: "transparent", border: "none", color: "#065f46", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flex: "1 1 300px", maxWidth: "450px" }}>
          <input
            type="text"
            className="textInput"
            placeholder="Search by PI # or Quotation #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              Settlement:
            </span>
            <select
              className="textInput"
              style={{ width: "auto", padding: "0 12px", height: "38px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              Delivery:
            </span>
            <select
              className="textInput"
              style={{ width: "auto", padding: "0 12px", height: "38px" }}
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            >
              <option value="All">All Deliveries</option>
              <option value="Pending">Pending</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="supplierTableWrapper">
        {filteredPurchases.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            <b style={{ color: "var(--text-primary)", fontSize: "15px" }}>
              No Purchase Orders Found
            </b>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              {search || statusFilter !== "All" || deliveryFilter !== "All"
                ? "Try clearing filters to view all orders."
                : "Your supplier account does not have any orders assigned yet."}
            </p>
          </div>
        ) : (
          <table className="supplierTable">
            <thead>
              <tr>
                <th>PI / PO Number</th>
                <th>Invoice Date</th>
                <th>Quotation Ref</th>
                <th>Materials Count</th>
                <th>Total Billed</th>
                <th>Destination</th>
                <th>Settlement</th>
                <th>Delivery Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p, idx) => {
                const no = p.piNumber || (Array.isArray(p) ? p[0] : `PO-${idx + 1}`);
                const dt = p.piDate || (Array.isArray(p) ? p[1] : "—");
                const quote = p.quotationNumber || (Array.isArray(p) ? p[3] : "—");
                const itemsCount = p.itemsCount || (p.lineItems ? p.lineItems.length : 1);
                const amt = p.totalAmount || (Array.isArray(p) ? p[5] : "—");
                const loc = p.location || "Central Warehouse";
                const stat = p.status || (Array.isArray(p) ? p[6] : "Approved");
                const deliv = p.deliveryStatus || (Array.isArray(p) ? p[7] : "Pending") || "Pending";

                return (
                  <tr key={no || idx}>
                    <td>
                      <b style={{ color: "var(--brand-600)" }}>{no}</b>
                    </td>
                    <td>{dt}</td>
                    <td>{quote}</td>
                    <td>{itemsCount} items</td>
                    <td>
                      <b>{amt}</b>
                    </td>
                    <td>{loc}</td>
                    <td>
                      <Badge
                        status={
                          stat.toLowerCase() === "paid" || stat.toLowerCase() === "completed"
                            ? "Completed"
                            : stat.toLowerCase() === "partial"
                            ? "Pending"
                            : "Approved"
                        }
                      />
                    </td>
                    <td>
                      <Badge>{deliv}</Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSelectedPo(p)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PO Detail Drawer */}
      {selectedPo && (
        <>
          <div
            className="mobileBackdrop"
            style={{ zIndex: 999 }}
            onClick={() => setSelectedPo(null)}
          />
          <div className="orderDetailDrawer">
            <div className="drawerHeader">
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "var(--brand-600)",
                    textTransform: "uppercase",
                  }}
                >
                  Purchase Order Details
                </span>
                <h3 style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {selectedPo.piNumber || (Array.isArray(selectedPo) ? selectedPo[0] : "Order")}
                </h3>
              </div>
              <button
                type="button"
                className="drawerCloseBtn"
                onClick={() => setSelectedPo(null)}
              >
                ×
              </button>
            </div>

            <div className="drawerBody">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "12px",
                  background: "#f8fafc",
                  padding: "14px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Date</small>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>
                    {selectedPo.piDate || (Array.isArray(selectedPo) ? selectedPo[1] : "—")}
                  </div>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Quotation #</small>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>
                    {selectedPo.quotationNumber || (Array.isArray(selectedPo) ? selectedPo[3] : "—")}
                  </div>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Total Amount</small>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--brand-600)" }}>
                    {selectedPo.totalAmount || (Array.isArray(selectedPo) ? selectedPo[5] : "—")}
                  </div>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Delivery Location</small>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>
                    {selectedPo.location || "Central Warehouse"}
                  </div>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Delivery Status</small>
                  <div style={{ marginTop: "4px" }}>
                    <Badge>{selectedPo.deliveryStatus || (Array.isArray(selectedPo) ? selectedPo[7] : "Pending") || "Pending"}</Badge>
                  </div>
                </div>
              </div>

              {/* Line items if available */}
              <h4 style={{ fontSize: "13.5px", fontWeight: "700", marginBottom: "10px" }}>
                Ordered Materials
              </h4>

              {selectedPo.lineItems && selectedPo.lineItems.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedPo.lineItems.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "12.5px",
                      }}
                    >
                      <div>
                        <b>{item.materialName || item.name}</b>
                        <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                          Qty: {item.quantity || item.qty} {item.unit || "Pcs"} @ ₹{item.rate || 0}
                        </div>
                      </div>
                      <div style={{ fontWeight: "600" }}>
                        ₹{Number((item.quantity || 0) * (item.rate || 0)).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                  Standard batch delivery record with{" "}
                  {selectedPo.itemsCount || (Array.isArray(selectedPo) ? selectedPo[4] : 1)} items.
                </p>
              )}

              {selectedPo.remarks && (
                <div style={{ marginTop: "20px" }}>
                  <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Remarks</small>
                  <p style={{ fontSize: "13px", marginTop: "2px" }}>{selectedPo.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Place Supply Order Modal */}
      {isCreateModalOpen && (
        <div className="orderModalBackdrop">
          <div className="orderModalContainer">
            <div className="modalHeader">
              <div>
                <h3 className="modalTitle">📦 Place Supply Order / Delivery Requisition</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Submit order items directly to PDV Operations Admin. It will be reflected in the Purchases Master.
                </p>
              </div>
              <button
                type="button"
                className="drawerCloseBtn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitOrder}
              className="orderModalForm"
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div className="modalBody">
                <div className="formRowGrid">
                  <div>
                    <label className="fieldLabel">Order Reference #</label>
                    <input
                      type="text"
                      className="fieldInput"
                      required
                      value={orderForm.orderNumber}
                      onChange={(e) => setOrderForm({ ...orderForm, orderNumber: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="fieldLabel">Order Date</label>
                    <input
                      type="date"
                      className="fieldInput"
                      required
                      value={orderForm.orderDate}
                      onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="fieldLabel">Delivery Destination</label>
                    <select
                      className="fieldInput"
                      value={orderForm.location}
                      onChange={(e) => setOrderForm({ ...orderForm, location: e.target.value })}
                    >
                      <option value="Central Warehouse">Central Warehouse (Main Hub)</option>
                      <option value="Vrindavan Site Phase 1">Vrindavan Site Phase 1</option>
                      <option value="Site Sector 4">Site Sector 4</option>
                      <option value="Direct Site Delivery">Direct Site Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="fieldLabel">Quotation Ref # (Optional)</label>
                    <input
                      type="text"
                      className="fieldInput"
                      value={orderForm.quotationNumber}
                      onChange={(e) => setOrderForm({ ...orderForm, quotationNumber: e.target.value })}
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="fieldLabel" style={{ margin: 0, fontSize: "13px" }}>
                      Material Items to Supply ({lineItems.length})
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={handleAddLineItem}
                    >
                      + Add Item
                    </button>
                  </div>

                  {/* Desktop Table View (hidden on mobile <=640px) */}
                  <div className="lineItemsTableWrapper desktopOnlyTable">
                    <table className="lineItemsTable">
                      <thead>
                        <tr>
                          <th style={{ minWidth: "220px" }}>Material Description</th>
                          <th style={{ width: "70px", textAlign: "center" }}>Unit</th>
                          <th style={{ width: "95px" }}>Quantity</th>
                          <th style={{ width: "115px" }}>Fixed Rate (₹)</th>
                          <th style={{ width: "110px", textAlign: "right" }}>Total (₹)</th>
                          <th style={{ width: "40px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                className="fieldInput lineItemSelect"
                                value={item.materialName}
                                onChange={(e) => handleUpdateLineItem(idx, "materialName", e.target.value)}
                              >
                                {materialCatalog.map((m, mIdx) => (
                                  <option key={mIdx} value={m.name}>
                                    {m.name} ({m.unit} • ₹{m.rate})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className="unitBadge">{item.unit || "Pcs"}</span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                className="fieldInput quantityInput"
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value)}
                              />
                            </td>
                            <td>
                              <div className="lockedRateBox" title="Price fixed by Admin in Inventory Master">
                                <span className="lockIcon">🔒</span>
                                <span className="lockedRateText">₹ {Number(item.rate || 0).toLocaleString()}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "700", color: "var(--brand-700)" }}>
                              ₹ {(item.total || 0).toLocaleString()}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {lineItems.length > 1 && (
                                <button
                                  type="button"
                                  className="lineItemRemoveBtn"
                                  title="Remove Item"
                                  onClick={() => handleRemoveLineItem(idx)}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Stacked Cards (visible on <= 640px) */}
                  <div className="mobileLineItemsList">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="mobileLineItemCard">
                        {/* Top Bar with Badge and Delete Button */}
                        <div className="mobileLineItemTopBar">
                          <span className="mobileLineItemBadge">Item #{idx + 1}</span>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              className="mobileLineItemRemoveBtn"
                              title="Remove item"
                              aria-label="Remove item"
                              onClick={() => handleRemoveLineItem(idx)}
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        {/* Full Width Material Selector */}
                        <div className="mobileMaterialSelectWrap">
                          <label className="mobileLineItemFieldLabel">Select Material</label>
                          <select
                            className="fieldInput mobileSelectInput"
                            value={item.materialName}
                            onChange={(e) => handleUpdateLineItem(idx, "materialName", e.target.value)}
                          >
                            {materialCatalog.map((m, mIdx) => (
                              <option key={mIdx} value={m.name}>
                                {m.name} ({m.unit} • ₹{m.rate})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mobileLineItemCardBody">
                          <div className="mobileQtyCol">
                            <label className="mobileLineItemFieldLabel">
                              Quantity ({item.unit || "Pcs"})
                            </label>
                            <div className="mobileQtyInputWrap">
                              <input
                                type="number"
                                min="1"
                                className="fieldInput mobileQtyInput"
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value)}
                              />
                              <span className="mobileUnitTag">{item.unit || "Pcs"}</span>
                            </div>
                          </div>

                          <div className="mobileRateCol">
                            <label className="mobileLineItemFieldLabel">Fixed Unit Rate</label>
                            <div className="lockedRateBox mobileLockedRate">
                              <span className="lockIcon">🔒</span>
                              <span className="lockedRateText">₹ {Number(item.rate || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mobileLineItemCardFooter">
                          <span className="mobileItemSubtotalLabel">Item Subtotal:</span>
                          <span className="mobileItemSubtotalVal">
                            ₹ {(item.total || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remarks */}
                <div style={{ marginTop: "16px" }}>
                  <label className="fieldLabel">Delivery Remarks / Special Instructions</label>
                  <textarea
                    className="fieldInput"
                    rows={2}
                    placeholder="Provide any dispatch notes, batch numbers, or delivery time preferences..."
                    value={orderForm.remarks}
                    onChange={(e) => setOrderForm({ ...orderForm, remarks: e.target.value })}
                  />
                </div>

                {/* Total Summary */}
                <div
                  style={{
                    marginTop: "16px",
                    background: "var(--brand-50)",
                    border: "1px solid var(--brand-200)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--brand-900)" }}>
                    Total Order Valuation:
                  </span>
                  <strong style={{ fontSize: "16px", color: "var(--brand-700)" }}>
                    ₹ {orderGrandTotal.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btn-secondary modalCancelBtn"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary modalSubmitBtn">
                  <span className="submitTextFull">Submit Order to PDV Operations</span>
                  <span className="submitTextShort">Submit Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

