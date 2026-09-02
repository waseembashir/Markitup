"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/app/AppSidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { removeTeamMember } from "@/app/app/team-actions";
import type { TeamData, TeamMember, TeamGuest } from "@/app/app/team-actions";

type TabKey = "admins" | "managers" | "guests";

function RoleChip({ kind }: { kind: "Owner" | "Admin" | "Manager" | "Guest" }) {
  const style =
    kind === "Admin" || kind === "Owner"
      ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }
      : kind === "Manager"
        ? { background: "var(--color-canvas)", color: "var(--color-ink)" }
        : { background: "var(--color-canvas)", color: "var(--color-muted)" };
  return <span className="chip" style={style}>{kind}</span>;
}

function PendingChip() {
  return (
    <span className="chip" style={{ background: "var(--color-warning-soft, var(--color-canvas))", color: "var(--color-warning, var(--color-muted))" }}>
      Pending
    </span>
  );
}

const ROW_GRID = "grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1.4fr_1fr_auto]";

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-danger-soft hover:text-danger"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function MemberRow({ m, canManage, onRemove }: { m: TeamMember; canManage: boolean; onRemove: (m: TeamMember) => void }) {
  const kind = m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : "Manager";
  // The owner can't be removed and you can't remove yourself — the RLS policy
  // enforces both, so the button is simply not offered for those rows.
  const removable = canManage && !m.isYou && m.role !== "owner";
  return (
    <div className={ROW_GRID}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={m.name} email={m.email} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {m.name}
            {m.isYou && <span className="ml-2 font-normal text-faint">(you)</span>}
          </div>
          <div className="truncate text-xs text-faint sm:hidden">{m.email}</div>
        </div>
      </div>
      <div className="hidden min-w-0 truncate text-sm text-muted sm:block">{m.email}</div>
      <div className="flex items-center justify-end gap-2 justify-self-end">
        {m.pending ? <PendingChip /> : <RoleChip kind={kind} />}
        {removable && (
          <RemoveButton
            label={m.pending ? `Revoke invitation for ${m.email}` : `Remove ${m.name} from the workspace`}
            onClick={() => onRemove(m)}
          />
        )}
      </div>
    </div>
  );
}

function GuestRow({ g }: { g: TeamGuest }) {
  return (
    <div className={ROW_GRID}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={g.name} email={g.email} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{g.name}</div>
          <div className="truncate text-xs text-faint sm:hidden">{g.email}</div>
        </div>
      </div>
      <div className="hidden min-w-0 truncate text-sm text-muted sm:block">{g.email}</div>
      <div className="justify-self-end">{g.pending ? <PendingChip /> : <RoleChip kind="Guest" />}</div>
    </div>
  );
}

export function TeamRoster({ data }: { data: TeamData }) {
  const [tab, setTab] = useState<TabKey>("admins");
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function confirmRemove() {
    const target = pendingRemove;
    if (!target) return;
    start(async () => {
      const res = await removeTeamMember(target.pending ? target.email : target.id);
      setPendingRemove(null);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(target.pending ? "Invitation revoked" : `${target.name} removed`);
        router.refresh();
      }
    });
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "admins", label: "Admin", count: data.admins.length },
    { key: "managers", label: "Manager", count: data.managers.length },
    { key: "guests", label: "Guests", count: data.guests.length },
  ];

  const empty =
    (tab === "admins" && data.admins.length === 0) ||
    (tab === "managers" && data.managers.length === 0) ||
    (tab === "guests" && data.guests.length === 0);

  return (
    <div className="card overflow-hidden">
      {/* Role tabs */}
      <div className="flex gap-6 border-b px-4">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative -mb-px py-3 text-sm font-semibold transition-colors"
              style={{ color: on ? "var(--color-ink)" : "var(--color-muted)" }}
            >
              {t.label} <span className="text-faint">{t.count}</span>
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: "var(--color-brand)" }} />}
            </button>
          );
        })}
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b bg-surface px-4 py-3 text-xs font-semibold tracking-wider text-faint uppercase sm:grid-cols-[1.4fr_1fr_auto]">
        <span>Name</span>
        <span className="hidden sm:block">Email</span>
        <span>Role</span>
      </div>

      {empty ? (
        <p className="px-4 py-10 text-center text-sm text-faint">
          {tab === "guests"
            ? "No guests yet. Share a project or file with a client to add one."
            : tab === "managers"
              ? "No managers yet. Invite a teammate as a Manager."
              : "No admins yet."}
        </p>
      ) : (
        <div className="divide-y">
          {tab === "admins" && data.admins.map((m) => <MemberRow key={m.id} m={m} canManage={data.canManage} onRemove={setPendingRemove} />)}
          {tab === "managers" && data.managers.map((m) => <MemberRow key={m.id} m={m} canManage={data.canManage} onRemove={setPendingRemove} />)}
          {tab === "guests" && data.guests.map((g) => <GuestRow key={g.email} g={g} />)}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title={pendingRemove?.pending ? "Revoke this invitation?" : "Remove from the workspace?"}
        message={
          pendingRemove?.pending ? (
            <>
              <b className="text-ink">{pendingRemove?.email}</b> won&apos;t be able to join with this
              invitation. You can invite them again at any time.
            </>
          ) : (
            <>
              <b className="text-ink">{pendingRemove?.name}</b> loses access to every project in this
              workspace straight away. Their comments stay where they are.
            </>
          )
        }
        confirmLabel={pendingRemove?.pending ? "Revoke invitation" : "Remove"}
        pendingLabel={pendingRemove?.pending ? "Revoking…" : "Removing…"}
        pending={busy}
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}
