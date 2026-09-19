"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { getStorageData, STORAGE_KEYS } from "@/lib/dataService";
import "./supplier.css";

export default function SupplierDashboardPage() {
  const { user } = useAuth();

  const [supplierData, setSupplierData] = useState({
    profile: null,
    purchases: [],
    bills: [],
    products: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load server-isolated data for this authenticated supplier
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const clientPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
        const clientBills = getStorageData(STORAGE_KEYS.BILLS, []);
        const clientProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);

        const res = await fetch("/api/supplier/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchases: clientPurchases,
            bills: clientBills,
            products: clientProducts,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setSupplierData({
              profile: json.supplier,
              purchases: json.data.purchases || [],
              bills: json.data.bills || [],
              products: json.data.products || [],
            });
          }
        }
      } catch (err) {
        console.error("[Supplier Portal] Error loading scoped data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const { purchases, bills, profile } = supplierData;

  // Calculate Metrics strictly for this supplier
  const totalOrders = purchases.length;
  const pendingOrders = purchases.filter((p) => {
    const stat = (p.status || (Array.isArray(p) ? p[6] : "")).toLowerCase();
    return stat !== "completed" && stat !== "paid";
  }).length;
  const completedOrders = totalOrders - pendingOrders;

  // Parse numerical total billed from this vendor
  const totalBilledValue = purchases.reduce((acc, p) => {
    const rawAmt = p.totalAmount || (Array.isArray(p) ? p[5] : "0");
    const num = Number(String(rawAmt).replace(/[^0-9.-]+/g, "")) || 0;
    return acc + num;
  }, 0);

  const companyName = profile?.companyName || user?.supplierName || "Supplier Workspace";
  const supplierCode = profile?.code || user?.supplierCode || "SUP-001";



  return (
    <Shell>
      {/* 1. Clean Top Header Card */}
      <div className="supplierBanner">
        <div className="supplierBannerLeft">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1>{companyName}</h1>
            <span className="supplierMetaBadge">
              Code: {supplierCode} · {profile?.status || "Active"}
            </span>
          </div>
          <p>Supplier Portal · Track orders and material dispatches.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/supplier/orders?action=new" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>+</span> Place Order
          </Link>
        </div>
      </div>



      {/* 3. Clean Metrics Grid */}
      <div className="supplierMetricsGrid">
        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Total Orders</span>
            <span className="supplierMetricIcon">📋</span>
          </div>
          <div className="supplierMetricValue">{totalOrders}</div>
          <span className="supplierMetricSubtext">All time orders</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Pending</span>
            <span className="supplierMetricIcon">⏳</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#d97706" }}>
            {pendingOrders}
          </div>
          <span className="supplierMetricSubtext">To dispatch / deliver</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Completed</span>
            <span className="supplierMetricIcon">✓</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#059669" }}>
            {completedOrders}
          </div>
          <span className="supplierMetricSubtext">Delivered & verified</span>
        </div>

        <div className="supplierMetricCard">
          <div className="supplierMetricHeader">
            <span className="supplierMetricLabel">Total Billed</span>
            <span className="supplierMetricIcon">₹</span>
          </div>
          <div className="supplierMetricValue" style={{ color: "#4f46e5" }}>
            ₹ {totalBilledValue.toLocaleString()}
          </div>
          <span className="supplierMetricSubtext">Total billed value</span>
        </div>
      </div>

      {/* 4. Recent Orders Table */}
      <div className="sectionHeaderRow" style={{ marginTop: "8px", marginBottom: "14px" }}>
        <h2 className="sectionTitle">Recent Orders</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/supplier/orders" className="btn btn-sm btn-secondary" style={{ textDecoration: "none" }}>
            View All ({totalOrders}) ➔
          </Link>
        </div>
      </div>

      <div className="supplierTableWrapper">
        {purchases.length === 0 ? (
          <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📦</div>
            <b style={{ color: "var(--text-primary)" }}>No Orders Yet</b>
            <p style={{ fontSize: "13px", marginTop: "2px" }}>
              Click "+ Place Order" above to submit a new supply order.
            </p>
          </div>
        ) : (
          <table className="supplierTable">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Date</th>
                <th>Quote Ref</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Destination</th>
                <th>Payment</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {purchases.slice(0, 5).map((p, idx) => {
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
                    <td>{itemsCount} {itemsCount === 1 ? "item" : "items"}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Minimal Support Line */}
      <div style={{ marginTop: "20px", textAlign: "center", fontSize: "12.5px", color: "#64748b" }}>
        Need support? Email Procurement at <code>procurement@pdv.com</code>
      </div>
    </Shell>
  );
}
