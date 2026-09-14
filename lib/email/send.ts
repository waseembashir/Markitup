import { getResend } from "./client";
import { reportIssue, reportError } from "../observability";

export const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

// Resend's shared testing domain only delivers to the address that owns the
// Resend account. Falling back to it silently is how every client invitation
// can fail for weeks while the dashboard reports success — the send is rejected
// at the API, the error is caught, and nobody is told. In production, treat an
// unset EMAIL_FROM as the outage it is.
const USING_TEST_SENDER = !process.env.EMAIL_FROM;

// Report configuration problems once per server instance, not once per email.
let warnedNoKey = false;
let warnedTestSender = false;

// Only the domain — the local part is the client's identity and has no
// diagnostic value.
const domainOf = (address: string) => address.split("@")[1] ?? "(malformed)";

// Best-effort send. Returns { ok } and never throws — email problems must not
// break the Server Action that triggered them. They must, however, be visible.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  cc?: string;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) {
    // Expected locally: .env.development.local leaves the key unset so no real
    // client can receive a test email. In production it means nothing is sending.
    if (process.env.NODE_ENV === "production" && !warnedNoKey) {
      warnedNoKey = true;
      reportIssue("RESEND_API_KEY is not set — no email is being sent at all");
    } else {
      console.warn(`[email] RESEND_API_KEY not set; skipping "${opts.subject}"`);
    }
    return { ok: false };
  }

  if (USING_TEST_SENDER && process.env.NODE_ENV === "production" && !warnedTestSender) {
    warnedTestSender = true;
    reportIssue(
      "EMAIL_FROM is not set, so mail is sent from onboarding@resend.dev, which only delivers to the Resend account owner",
      { affects: "every email to a client or teammate" },
    );
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      ...(opts.cc ? { cc: opts.cc } : {}),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      reportIssue("Email rejected by Resend", {
        reason: error.message,
        recipientDomain: domainOf(opts.to),
        from: EMAIL_FROM,
        subject: opts.subject,
      });
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    reportError(e, { where: "sendEmail", recipientDomain: domainOf(opts.to), subject: opts.subject });
    return { ok: false };
  }
}
