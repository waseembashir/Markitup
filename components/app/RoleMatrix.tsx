// "What each role can do" — the documented policy behind the three team tiers.
// Columns: Admin / Manager / Guest.
const ROWS: { label: string; admin: boolean; manager: boolean; guest: boolean }[] = [
  { label: "View & manage all projects and files", admin: true, manager: true, guest: false },
  { label: "Upload, edit and delete content", admin: true, manager: true, guest: false },
  { label: "Share with clients & send invites", admin: true, manager: true, guest: false },
  { label: "See Insights", admin: true, manager: true, guest: false },
  { label: "Manage Settings & the team", admin: true, manager: false, guest: false },
  { label: "View & comment via a share link", admin: true, manager: true, guest: true },
  { label: "Needs a MarkItUp login", admin: true, manager: true, guest: false },
];

function Cell({ on }: { on: boolean }) {
  return on ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mx-auto" style={{ color: "var(--color-success)" }} aria-label="Yes">
      <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <span className="mx-auto block h-px w-3 bg-[color:var(--color-faint)]" aria-label="No" />
  );
}

export function RoleMatrix() {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-base font-bold text-ink">What each role can do</h2>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface text-xs font-semibold tracking-wider text-faint uppercase">
                <th className="px-4 py-3 text-left font-semibold">Capability</th>
                <th className="px-4 py-3 text-center font-semibold">Admin</th>
                <th className="px-4 py-3 text-center font-semibold">Manager</th>
                <th className="px-4 py-3 text-center font-semibold">Guest</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-4 text-ink">{r.label}</td>
                  <td className="px-4 py-4"><Cell on={r.admin} /></td>
                  <td className="px-4 py-4"><Cell on={r.manager} /></td>
                  <td className="px-4 py-4"><Cell on={r.guest} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t bg-surface px-4 py-3 text-xs text-faint">
          Guests are external clients you share a project or file with. They view and comment via the share link, no account needed.
        </p>
      </div>
    </section>
  );
}
