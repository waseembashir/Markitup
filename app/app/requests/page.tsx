import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getNotifications } from "@/app/app/notifications-actions";
import { AccessRequestList } from "@/components/app/AccessRequestList";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { emailLocalPart } from "@/lib/format";

// Where the "someone wants access" email lands. The bell can approve a request
// too, but an email needs somewhere to point that works on a phone, months
// later, without hunting through a dropdown.
export default async function RequestsPage() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email ?? "";
  const name = (authData.user?.user_metadata?.name as string) || emailLocalPart(email) || "";

  const { items } = await getNotifications();
  const requests = items.filter((n) => n.type === "access_request" && n.projectId);

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access requests</h1>
          <p className="mt-1 text-sm text-muted">People asking to see a file you can share.</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ProfileMenu name={name} email={email} />
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rise-in card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No requests waiting</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            When someone opens a link to a file they can&apos;t see, their request shows up here.{" "}
            <Link href="/app" className="font-semibold text-brand-ink">Back to the dashboard</Link>
          </p>
        </div>
      ) : (
        <AccessRequestList requests={requests} />
      )}
    </div>
  );
}
