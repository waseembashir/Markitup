import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { AppChrome } from "@/components/app/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const ws = await getCurrentWorkspace();

  return (
    <AppChrome workspaceName={ws?.name ?? "MarkUp"} isGuest={data.user.is_anonymous === true}>
      {children}
    </AppChrome>
  );
}
