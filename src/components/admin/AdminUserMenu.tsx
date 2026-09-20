import Image from "next/image";
import type { AdminViewer } from "@/lib/admin/presentation";
import { formatRoleLabel, getInitials } from "@/lib/admin/presentation";
import { signOutAdmin } from "@/lib/admin/actions";
import styles from "./AdminUserMenu.module.css";

type AdminUserMenuProps = {
  user: AdminViewer;
};

export function AdminUserMenu({ user }: AdminUserMenuProps) {
  return (
    <div className={styles.root}>
      <div className={styles.identity}>
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt=""
            width={36}
            height={36}
            className={styles.avatar}
          />
        ) : (
          <span className={styles.initials} aria-hidden="true">
            {getInitials(user.name)}
          </span>
        )}
        <div className={styles.meta}>
          <p className={styles.name}>{user.name}</p>
          <p className={styles.role}>{formatRoleLabel(user.role)}</p>
        </div>
      </div>
      <form action={signOutAdmin}>
        <button type="submit" className={styles.signOut}>
          Sign out
        </button>
      </form>
    </div>
  );
}
