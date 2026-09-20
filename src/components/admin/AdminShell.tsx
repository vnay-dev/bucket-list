"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AdminNavItem } from "@/lib/admin/navigation";
import type { AdminViewer } from "@/lib/admin/presentation";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import styles from "./AdminShell.module.css";

type AdminShellProps = {
  user: AdminViewer;
  navItems: AdminNavItem[];
  children: ReactNode;
};

export function AdminShell({ user, navItems, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className={styles.shell}>
      <a href="#admin-main" className={styles.skipLink}>
        Skip to content
      </a>

      <header className={styles.mobileBar}>
        <Link href="/admin" className={styles.brand} onClick={closeMenu}>
          Bucket List
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      <div className={styles.frame}>
        <aside
          id={menuId}
          className={menuOpen ? styles.sidebarOpen : styles.sidebar}
          aria-label="Admin navigation"
        >
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarTop}>
              <Link href="/admin" className={styles.brandDesktop} onClick={closeMenu}>
                Bucket List
              </Link>
              <p className={styles.sidebarLabel}>Admin</p>
              <AdminNav items={navItems} onNavigate={closeMenu} />
            </div>
            <AdminUserMenu user={user} />
          </div>
        </aside>

        {menuOpen ? (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close navigation"
            onClick={closeMenu}
          />
        ) : null}

        <div className={styles.content}>
          <main id="admin-main" className={styles.main} tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
