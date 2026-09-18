// Shared transactional-email helpers — safe for client + server (no server-only imports).

export type EmailTemplateKey = "client_invite" | "team_invite";

export type EmailTemplate = { subject: string; message: string; button_label: string };

// Replace every {{ placeholder }} with its value (unknown placeholders → "").
export function fillEmailTemplate(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplateKey, EmailTemplate> = {
  client_invite: {
    subject: '{{sender}} shared "{{page_name}}" with you',
    message:
      '{{sender}} shared the {{type}} "{{page_name}}" with you on MarkItUp. Click the button below and leave your feedback. No account needed.',
    button_label: "View & comment",
  },
  team_invite: {
    subject: "{{inviter}} invited you to {{workspace}}",
    message:
      "{{inviter}} has invited you to join their MarkItUp workspace as {{role}}. Click below to create your account and get started.",
    button_label: "Accept invite",
  },
};

// UI metadata: sub-tab label, help copy, insertable placeholders, and sample
// values used to render the live preview.
export const EMAIL_TEMPLATE_META: {
  key: EmailTemplateKey;
  label: string;
  description: string;
  placeholders: readonly string[];
  sample: Record<string, string>;
  toLabel: string; // what the "to" line shows in the preview
}[] = [
  {
    key: "client_invite",
    label: "Client invite",
    description: "Sent when you Send to client — shares a view-and-comment link. No account needed.",
    placeholders: ["page_name", "project", "type", "sender"],
    sample: { sender: "Sajad Sheikh", page_name: "Homepage file", type: "file", project: "Chorus" },
    toLabel: "client@email.com",
  },
  {
    key: "team_invite",
    label: "Team invite",
    description: "Sent when you invite a teammate to this workspace.",
    placeholders: ["inviter", "role", "workspace"],
    sample: { inviter: "Sajad Sheikh", role: "Manager", workspace: "Apexure" },
    toLabel: "teammate@agency.com",
  },
];
