"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Image from "next/image";
import { PageHeader } from "@/components/admin/PageHeader";
import type { TeamMember } from "@/lib/admin/team";
import {
  changeAdminRoleAction,
  grantCuratorAccessAction,
  lookupUserByEmailAction,
  removeCuratorAccessAction,
} from "@/lib/admin/team-actions";
import {
  teamNoticeMessage,
  type TeamActionNotice,
} from "@/lib/admin/team-helpers";
import {
  formatRelativeDate,
  formatRoleLabel,
  getInitials,
} from "@/lib/admin/presentation";
import type { UserRole } from "@/lib/auth/roles";
import styles from "./TeamList.module.css";

type LookupUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: UserRole;
};

type TeamListProps = {
  members: TeamMember[];
  currentUserId: string;
  superAdminCount: number;
  notice: TeamActionNotice | null;
  errorMessage?: string | null;
};

type DialogState =
  | { type: "role"; member: TeamMember; nextRole: "curator" | "superadmin" }
  | { type: "remove"; member: TeamMember }
  | { type: "grant"; user: LookupUser }
  | null;

export function TeamList({
  members,
  currentUserId,
  superAdminCount,
  notice,
  errorMessage,
}: TeamListProps) {
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<LookupUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(
    notice ? teamNoticeMessage(notice) : null,
  );
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (dialog) {
      if (!node.open) node.showModal();
    } else if (node.open) {
      node.close();
    }
  }, [dialog]);

  function runAction(
    action: () => Promise<{
      ok: boolean;
      message?: string;
      fieldErrors?: Record<string, string>;
    }>,
  ) {
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setDialog(null);
      }
    });
  }

  function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookup(null);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    startTransition(async () => {
      const result = await lookupUserByEmailAction({ email });
      if (!result.ok) {
        setError(result.message);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }
      setLookup(result.user);
    });
  }

  function canChangeRole(member: TeamMember): boolean {
    if (member.id === currentUserId) return false;
    if (member.role === "superadmin" && superAdminCount <= 1) return false;
    return true;
  }

  function canRemove(member: TeamMember): boolean {
    return member.role === "curator" && member.id !== currentUserId;
  }

  return (
    <div className={styles.root}>
      <PageHeader
        title="Team"
        description="Manage who has curator and superadmin access to this product."
      />

      {success ? (
        <p className={styles.notice} role="status">
          {success}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.addSection} aria-labelledby="add-curator-heading">
        <h2 id="add-curator-heading" className={styles.sectionTitle}>
          Add curator
        </h2>
        <p className={styles.sectionCopy}>
          Find an existing account by email. People must sign in with Google
          once before they can be granted access.
        </p>

        <form className={styles.lookupForm} onSubmit={onLookup} noValidate>
          <div className={styles.field}>
            <label htmlFor={emailId} className={styles.label}>
              Email
            </label>
            <div className={styles.lookupRow}>
              <input
                id={emailId}
                className={styles.input}
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setLookup(null);
                }}
                placeholder="name@example.com"
                disabled={isPending}
                autoComplete="email"
              />
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={isPending}
              >
                {isPending ? "Looking up…" : "Find user"}
              </button>
            </div>
            {fieldErrors.email ? (
              <p className={styles.fieldError}>{fieldErrors.email}</p>
            ) : null}
          </div>
        </form>

        {lookup ? (
          <div className={styles.lookupResult}>
            <div className={styles.memberIdentity}>
              <Avatar name={lookup.name} avatar={lookup.avatar} />
              <div className={styles.memberMeta}>
                <p className={styles.memberName}>{lookup.name}</p>
                <p className={styles.memberEmail}>{lookup.email}</p>
                <p className={styles.memberRole}>
                  Current role: {formatRoleLabel(lookup.role)}
                </p>
              </div>
            </div>
            {lookup.role === "user" ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isPending}
                onClick={() => setDialog({ type: "grant", user: lookup })}
              >
                Grant curator access
              </button>
            ) : (
              <p className={styles.lookupHint}>
                This account already has administrative access.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="team-list-heading">
        <h2 id="team-list-heading" className={styles.sectionTitle}>
          Administrative team
        </h2>

        {members.length === 0 ? (
          <p className={styles.empty}>
            No curators or superadmins yet. Add a curator to get started.
          </p>
        ) : (
          <ul className={styles.list}>
            {members.map((member) => {
              const isYou = member.id === currentUserId;
              const protectedLast =
                member.role === "superadmin" && superAdminCount <= 1;

              return (
                <li key={member.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <div className={styles.memberIdentity}>
                      <Avatar name={member.name} avatar={member.avatar} />
                      <div className={styles.memberMeta}>
                        <p className={styles.memberName}>
                          {member.name}
                          {isYou ? (
                            <span className={styles.youBadge}>You</span>
                          ) : null}
                        </p>
                        <p className={styles.memberEmail}>{member.email}</p>
                      </div>
                    </div>
                    <div className={styles.itemDetails}>
                      <p className={styles.roleBadge}>
                        {formatRoleLabel(member.role)}
                      </p>
                      <p className={styles.joined}>
                        Joined {formatRelativeDate(member.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    {canChangeRole(member) ? (
                      <>
                        {member.role === "curator" ? (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={isPending}
                            onClick={() =>
                              setDialog({
                                type: "role",
                                member,
                                nextRole: "superadmin",
                              })
                            }
                          >
                            Make superadmin
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={isPending}
                            onClick={() =>
                              setDialog({
                                type: "role",
                                member,
                                nextRole: "curator",
                              })
                            }
                          >
                            Make curator
                          </button>
                        )}
                      </>
                    ) : null}

                    {canRemove(member) ? (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={isPending}
                        onClick={() => setDialog({ type: "remove", member })}
                      >
                        Remove access
                      </button>
                    ) : null}

                    {isYou || protectedLast ? (
                      <p className={styles.protectedNote}>
                        {isYou
                          ? "Your own access is protected."
                          : "The last superadmin is protected."}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={() => setDialog(null)}
        aria-labelledby="team-dialog-title"
      >
        <div className={styles.dialogInner}>
          {dialog?.type === "grant" ? (
            <>
              <h2 id="team-dialog-title" className={styles.dialogTitle}>
                Grant curator access?
              </h2>
              <p className={styles.dialogCopy}>
                {dialog.user.name} ({dialog.user.email}) will be able to access
                the admin area and manage submissions, experiences, places, and
                tags.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      grantCuratorAccessAction({ email: dialog.user.email }),
                    )
                  }
                >
                  {isPending ? "Working…" : "Confirm"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPending}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}

          {dialog?.type === "role" ? (
            <>
              <h2 id="team-dialog-title" className={styles.dialogTitle}>
                {dialog.nextRole === "superadmin"
                  ? "Promote to superadmin?"
                  : "Change role to curator?"}
              </h2>
              <p className={styles.dialogCopy}>
                {dialog.nextRole === "superadmin"
                  ? `${dialog.member.name} will gain full team management access, including the ability to change other people’s roles.`
                  : `${dialog.member.name} will keep curator access but lose the ability to manage the team.`}
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={
                    dialog.nextRole === "superadmin"
                      ? styles.primaryButton
                      : styles.secondaryButton
                  }
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      changeAdminRoleAction({
                        userId: dialog.member.id,
                        role: dialog.nextRole,
                      }),
                    )
                  }
                >
                  {isPending
                    ? "Working…"
                    : dialog.nextRole === "superadmin"
                      ? "Confirm promotion"
                      : "Confirm change"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPending}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}

          {dialog?.type === "remove" ? (
            <>
              <h2 id="team-dialog-title" className={styles.dialogTitle}>
                Remove curator access?
              </h2>
              <p className={styles.dialogCopy}>
                {dialog.member.name} will become a normal user and lose admin
                access. Their account, submissions, and wishlist stay intact.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      removeCuratorAccessAction({
                        userId: dialog.member.id,
                      }),
                    )
                  }
                >
                  {isPending ? "Working…" : "Confirm remove"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPending}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return (
      <Image
        src={avatar}
        alt=""
        width={44}
        height={44}
        className={styles.avatar}
      />
    );
  }

  return (
    <span className={styles.initials} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
