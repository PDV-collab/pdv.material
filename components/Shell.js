"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import GlobalSearchModal from "@/components/ui/GlobalSearchModal";
import "./shell.css";

// Admin Navigation Menu (Clean & Simple)
const adminNavigationSections = [
  {
    title: "OPERATIONS",
    items: [
      { href: "/", label: "Dashboard", icon: "⌂" },
      { href: "/inventory", label: "Inventory", icon: "📦" },
      { href: "/purchases", label: "Purchases", icon: "▣" },
      { href: "/material-requests", label: "Requests", icon: "📋" },
      { href: "/material-issue", label: "Issue Materials", icon: "↗" },
      { href: "/material-consumption", label: "Consumption", icon: "◔" },
      { href: "/returns", label: "Returns", icon: "🔄" },
    ],
  },
  {
    title: "DIRECTORIES",
    items: [
      { href: "/party-ledger", label: "Party Ledger", icon: "⚖" },
      { href: "/parties", label: "Parties", icon: "🏗" },
      { href: "/suppliers", label: "Suppliers", icon: "♙" },
      { href: "/products", label: "Products", icon: "▦" },
      { href: "/upload", label: "Upload Vault", icon: "⇧" },
      { href: "/reports", label: "Reports & Sync", icon: "▤" },
      { href: "/supplier", label: "Supplier Portal", icon: "🏢" },
    ],
  },
];

// Supplier Dedicated Navigation Menu (Clean & Simple)
const supplierNavigationSections = [
  {
    title: "SUPPLIER PORTAL",
    items: [
      { href: "/supplier", label: "Dashboard", icon: "🏢" },
      { href: "/supplier/orders", label: "Orders", icon: "📋" },
      { href: "/supplier/materials", label: "Materials", icon: "📦" },
      { href: "/supplier/profile", label: "Profile", icon: "⚙" },
    ],
  },
];

export default function Shell({ children }) {
  const currentPath = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(currentPath)}`);
    }
  }, [isLoading, isAuthenticated, currentPath, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === "SUPPLIER" && !currentPath.startsWith("/supplier")) {
      router.replace("/supplier");
    }
  }, [isLoading, isAuthenticated, user, currentPath, router]);

  const isSupplier = user?.role === "SUPPLIER";
  const activeNavigationSections = isSupplier
    ? supplierNavigationSections
    : adminNavigationSections;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompactSidebar, setIsCompactSidebar] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          color: "#f8fafc",
          fontFamily: "var(--font-outfit), sans-serif",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 16,
            boxShadow: "0 10px 25px rgba(59, 130, 246, 0.35)",
          }}
        >
          P
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#f1f5f9",
          }}
        >
          PDV Material Management
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
          Checking authentication & redirecting to login...
        </div>
      </div>
    );
  }

  // Find current active page title
  let pageTitle = isSupplier ? "Supplier Portal" : "Dashboard";
  for (const section of activeNavigationSections) {
    const found = section.items.find((item) => {
      if (item.href === "/" && !isSupplier) return currentPath === "/";
      if (item.href === "/supplier" && isSupplier) return currentPath === "/supplier";
      return currentPath.startsWith(item.href);
    });
    if (found) {
      pageTitle = found.label;
      break;
    }
  }

  const handleLogout = async () => {
    await logout();
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : isSupplier
    ? "VE"
    : "SA";

  return (
    <div className={`app ${isCompactSidebar ? "compact" : ""}`}>
      {/* Dim backdrop overlay for mobile */}
      {isMobileMenuOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close navigation"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        {/* Brand Logo & Name */}
        <div className="brand">
          <span className="brandMark">{isSupplier ? "🏢" : "P"}</span>
          <div className="brandTextWrapper">
            <span className="brandName">
              {isSupplier ? "PDV Supplier" : "PDV Solutions"}
            </span>
            <span className="brandSub">
              {isSupplier ? "Supplier Portal" : "Material Management"}
            </span>
          </div>
          <button
            type="button"
            className="close"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="sidebarNavScroll">
          {activeNavigationSections.map((section) => (
            <div key={section.title} className="navSection">
              <p className="navLabel">{section.title}</p>
              <nav>
                {section.items.map((item) => {
                  const isActive =
                    currentPath === item.href ||
                    (item.href !== "/" && item.href !== "/supplier" && currentPath.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={isActive ? "active" : ""}
                    >
                      <i>{item.icon}</i>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User profile footer at bottom of sidebar with Red Log Out */}
        <div className="sideFoot">
          <div className="avatar">{userInitials}</div>
          <div className="userInfoBlock">
            <b title={user?.name || (isSupplier ? "Vasu Enterprises" : "Administrator")}>
              {user?.name || (isSupplier ? "Vasu Enterprises" : "Shyam Aggarwal")}
            </b>
            <small>
              {isSupplier
                ? `Supplier (${user?.supplierCode || "SUP-001"})`
                : "Administrator (Procurement)"}
            </small>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="sideLogoutBtn"
            title="Log Out"
            aria-label="Log Out"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Workspace Page Area */}
      <main className="workspace">
        {/* Top Header */}
        <header>
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          {/* Desktop sidebar collapse button */}
          <button
            type="button"
            className="collapse"
            onClick={() => setIsCompactSidebar(!isCompactSidebar)}
            aria-label="Collapse sidebar"
          >
            ☰
          </button>

          {/* Breadcrumb Title */}
          <div className="crumb">
            {isSupplier ? "Supplier Portal" : "Material Management"} <span>/</span> {pageTitle}
          </div>

          {/* Omnisearch Quick Button */}
          {!isSupplier && (
            <button
              type="button"
              className="headerSearchBar"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Global search (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="searchPrompt">Search stock, suppliers, PI#, vouchers...</span>
              <kbd className="searchKbd">Ctrl K</kbd>
            </button>
          )}

          {/* Header Right Side */}
          <div className="headRight">
            {!isSupplier && (
              <Link
                href="/reports"
                className="headerSyncBtn"
                title="Reports & Cloud Sync"
              >
                ⚡ Google Sync
              </Link>
            )}

            {/* User Dropdown / Profile */}
            <div className="userDropdownWrap">
              <button
                type="button"
                className="headAvatarBtn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User profile menu"
              >
                <div className="headAvatar">{userInitials}</div>
                <span className="headUserName">
                  {user?.name ? user.name.split(" ")[0] : isSupplier ? "Supplier" : "Admin"}
                </span>
                <span className={`headRolePill ${isSupplier ? "supplier" : "admin"}`}>
                  {isSupplier ? "Supplier" : "Admin"}
                </span>
                <span className="caret">▾</span>
              </button>

              {isUserMenuOpen && (
                <div className="userMenuPopup">
                  <div className="userMenuHeader">
                    <b>{user?.name || (isSupplier ? "Vasu Enterprises" : "Shyam Aggarwal")}</b>
                    <small>{user?.email || (isSupplier ? "supplier1@example.com" : "admin@pdv.com")}</small>
                    <span className="userMenuRoleBadge">
                      {isSupplier
                        ? `🏢 Supplier Portal (${user?.supplierCode || "SUP-001"})`
                        : "🛡️ Administrator"}
                    </span>
                  </div>
                  <div className="userMenuDivider" />

                  {isSupplier ? (
                    <Link
                      href="/supplier/profile"
                      className="userMenuItem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>🏢</span> Supplier Profile & Details
                    </Link>
                  ) : (
                    <Link
                      href="/reports"
                      className="userMenuItem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>📊</span> Reports & Cloud Hub
                    </Link>
                  )}

                  <div className="userMenuDivider" />
                  <button
                    type="button"
                    className="userMenuItem danger"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <span>🚪</span> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">{children}</div>
      </main>

      {/* Global Omnisearch Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
