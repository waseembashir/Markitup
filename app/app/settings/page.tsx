import { getFigmaConnection } from "@/app/app/figma-actions";
import { getSlackConnection } from "@/app/app/slack-actions";
import { FigmaConnect } from "@/components/app/FigmaConnect";
import { SlackConnect } from "@/components/app/SlackConnect";
import { ThemeSettings } from "@/components/app/ThemeSettings";
import { RemindersSettings } from "@/components/app/RemindersSettings";
import { getReminderData, getEmailSampleContext } from "@/app/app/reminder-actions";
import { getTeamData } from "@/app/app/team-actions";
import { getEmailTemplates } from "@/app/app/email-actions";
import { TeamRoster } from "@/components/app/TeamRoster";
import { TeamInviteDialog } from "@/components/app/TeamInviteDialog";
import { RoleMatrix } from "@/components/app/RoleMatrix";
import { TransactionalEmailSettings } from "@/components/app/TransactionalEmailSettings";
import { SettingsShell, type SettingsSection } from "@/components/app/SettingsShell";

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>
    </div>
  );
}

const PaletteIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.9 1.6-1.7 0-.5-.3-.9-.3-1.4 0-.6.5-1 1.1-1H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="7.5" cy="11" r="1.1" fill="currentColor" /><circle cx="12" cy="7.5" r="1.1" fill="currentColor" /><circle cx="16" cy="11" r="1.1" fill="currentColor" />
  </svg>
);
const BellIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const PlugIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TeamIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 19a5.5 5.5 0 0 0-2.2-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const MailIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function SettingsPage() {
  const [{ connected }, { connected: slackConnected }, { settings, schedules }, teamData, emailTemplates, emailSample] = await Promise.all([
    getFigmaConnection(),
    getSlackConnection(),
    getReminderData(),
    getTeamData(),
    getEmailTemplates(),
    getEmailSampleContext(),
  ]);

  const sections: SettingsSection[] = [
    {
      key: "reminders",
      label: "Client reminders",
      icon: BellIcon,
      content: (
        <>
          <SectionHead
            title="Client reminders"
            desc="Automatically follow up with clients until they leave feedback. Reminders only apply to files you send with “Send to client”."
          />
          <RemindersSettings initial={settings} schedules={schedules} sample={emailSample} />
        </>
      ),
    },
    {
      key: "team",
      label: "Team",
      icon: TeamIcon,
      content: (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Team</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">Invite people and manage what they can access.</p>
            </div>
            {teamData.canManage && <TeamInviteDialog />}
          </div>
          <TeamRoster data={teamData} />
          <RoleMatrix />
        </>
      ),
    },
    {
      key: "email",
      label: "Transactional email",
      icon: MailIcon,
      content: (
        <>
          <SectionHead
            title="Transactional email"
            desc="The emails MarkItUp sends on your behalf. Placeholders fill in automatically at send time."
          />
          <TransactionalEmailSettings initial={emailTemplates.templates} canManage={emailTemplates.canManage} sample={emailSample} />
        </>
      ),
    },
    {
      key: "integrations",
      label: "Integrations",
      icon: PlugIcon,
      content: (
        <>
          <SectionHead title="Integrations" desc="Connect the tools you already use." />
          <div className="space-y-4">
            <SlackConnect connected={slackConnected} />
            <FigmaConnect connected={connected} />
          </div>
        </>
      ),
    },
    {
      key: "appearance",
      label: "Appearance",
      icon: PaletteIcon,
      content: (
        <>
          <SectionHead title="Appearance" desc="Choose whether the app is light or dark." />
          <ThemeSettings />
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your workspace and preferences.</p>
      </div>
      <SettingsShell sections={sections} />
    </div>
  );
}
