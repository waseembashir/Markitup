// All landing-page copy lives here so it can be reviewed and edited in one
// place. Product claims are kept true to what MarkItUp actually does: uploads are
// PNG/JPG, HTML and Figma frames (PDFs are comment attachments only).

export const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
] as const;

export const HOW = [
  {
    key: "upload",
    title: "Upload anything",
    body: "Drop in PNG or JPG designs, live HTML pages or Figma frames, up to 25 MB each.",
  },
  {
    key: "share",
    title: "Share one link",
    body: "Clients open it and start commenting. No account to create, nothing to learn.",
  },
  {
    key: "loop",
    title: "Close the loop",
    body: "Reply, resolve and compare versions until every pin on the page is green.",
  },
] as const;

export type Step = {
  key: "point" | "talk" | "share" | "resolve";
  label: string;
  /** Rendered as `lead` + italic `accent`. */
  lead: string;
  accent: string;
  body: string;
};

export const STEPS: Step[] = [
  {
    key: "point",
    label: "Point at it",
    lead: "Put it ",
    accent: "exactly there.",
    body: "Click anywhere on the design to drop a numbered pin, or drag a box around a whole area. Everyone sees the exact spot you mean.",
  },
  {
    key: "talk",
    label: "Talk it through",
    lead: "Keep the ",
    accent: "whole conversation.",
    body: "Reply in threads, @mention a teammate and attach images or PDFs. New comments appear live, while you're looking.",
  },
  {
    key: "share",
    label: "Share it",
    lead: "Clients just ",
    accent: "click the link.",
    body: "Send one link and clients comment as guests, with no account to create. Lock a file when you need to and approve access in a click.",
  },
  {
    key: "resolve",
    label: "Close the loop",
    lead: "Tick it ",
    accent: "off.",
    body: "Resolve a comment and its pin turns green, so everyone can see what's done and what's still open.",
  },
];

export const EXTRAS = [
  {
    key: "reminder",
    title: "Automatic reminders",
    body: "Clients who haven't left feedback get a friendly nudge by email, and you hear about it if they still don't.",
  },
  {
    key: "slack",
    title: "Slack, minus the noise",
    body: "New comments post to your channel, batched per project so it stays readable.",
  },
  {
    key: "roles",
    title: "Roles and access",
    body: "Admins, Managers and Guests each see and do exactly what they should.",
  },
  {
    key: "figma",
    title: "Live Figma frames",
    body: "Import frames from a Figma prototype and pin comments right on them.",
  },
] as const;

export type Quote = {
  quote: string;
  name: string;
  role: string;
  avatar: number;
  tone: "lime" | "cream" | "lilac" | "peach" | "white";
};

// PLACEHOLDER: sample quotes written for the design. None of these people are
// real customers. Replace every entry with a real, approved client quote (and
// matching name, role and avatar) before this page goes live.
export const QUOTES: Quote[] = [
  {
    quote: "We used to lose a day working out what the client meant. Now they just point at it.",
    name: "Emma Clarke",
    role: "Creative Director",
    avatar: 3,
    tone: "lime",
  },
  {
    quote: "Our clients stopped sending screenshots with red circles on them. That alone was worth it.",
    name: "Marcus Lee",
    role: "Head of Growth",
    avatar: 7,
    tone: "cream",
  },
  {
    quote: "New versions keep the comments, so nobody repeats themselves on round three.",
    name: "Hannah Kowalski",
    role: "Studio Founder",
    avatar: 12,
    tone: "lilac",
  },
  {
    quote: "Clients comment without making an account, so they actually leave feedback.",
    name: "Diego Ramos",
    role: "Marketing Lead",
    avatar: 18,
    tone: "peach",
  },
  {
    quote: "Everything that needs doing is a numbered pin. Nothing slips through any more.",
    name: "Chloe Martin",
    role: "Project Manager",
    avatar: 22,
    tone: "white",
  },
];

export const FAQ = [
  {
    q: "Do my clients need an account?",
    a: "No. Share a public link and clients comment as guests straight away. For restricted files they sign in, ask for access, and you approve it from the notification or the email.",
  },
  {
    q: "What can I upload?",
    a: "PNG and JPG images, HTML files (shown live, so clients can scroll the real page) and frames imported from a Figma prototype. Files can be up to 25 MB. Comments can carry image and PDF attachments.",
  },
  {
    q: "What happens when I upload a new version?",
    a: "Add it to the same file and the feedback comes with it. Compare versions side by side, or hold Space to flip between them. You can also replace the file behind a version without losing its comments.",
  },
  {
    q: "Can I control who sees what?",
    a: "Yes. Workspace roles (Admin, Manager and Guest) decide who can do what, and restricted links make people request access before they can open a file.",
  },
  {
    q: "Does it work with Slack?",
    a: "Yes. Connect a channel and new comments are posted there, batched per project so the channel stays readable.",
  },
  {
    q: "Will clients get reminded to leave feedback?",
    a: "If you want them to. Automatic reminder emails nudge clients who haven't commented yet, and you're told if they still haven't after the last one.",
  },
  {
    q: "Can I get feedback on mobile designs?",
    a: "Yes. A file can have separate desktop and mobile views, each with its own feedback, and you choose which views clients see.",
  },
] as const;
