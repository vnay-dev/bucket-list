"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/lib/admin/navigation";
import { isAdminNavActive } from "@/lib/admin/navigation";
import styles from "./AdminNav.module.css";

type AdminNavProps = {
  items: AdminNavItem[];
  onNavigate?: () => void;
};

export function AdminNav({ items, onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Admin">
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isAdminNavActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? styles.linkActive : styles.link}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
