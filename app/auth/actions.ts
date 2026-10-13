"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { welcome } from "@/lib/email/templates";

// Only allow same-app relative paths as post-login destinations.
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  // Return success (with the destination) instead of redirecting server-side, so
  // the client can play the welcome animation before navigating.
  return { ok: true, redirect: safeNext(formData) };
}

export async function signUp(formData: FormData) {
  const name = String(formData.get("name"));
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: error.message };

  // Best-effort welcome email; never blocks or fails the signup.
  try {
    const tpl = welcome({ name: name || email });
    await sendEmail({ to: email, ...tpl });
  } catch (e) {
    console.error("[signup] welcome email failed", e);
  }

  return { ok: true, redirect: safeNext(formData) };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

// useActionState wrappers: on success signIn/signUp return { ok, redirect } so
// the client can play the welcome animation and then navigate; on failure they
// return { error }, which the form renders instead of silently reloading.
type AuthState = { error?: string; ok?: boolean; redirect?: string };

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return (await signIn(formData)) ?? {};
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return (await signUp(formData)) ?? {};
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

export async function requestPasswordReset(
  _prev: { error?: string; sent?: boolean },
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const raw = formData.get("email");
  const email = (typeof raw === "string" ? raw : "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address" };
  const supabase = await createServerSupabase();
  // Ignore the result to avoid revealing whether an account exists.
  // Route through /auth/callback so the PKCE code is exchanged server-side,
  // which makes cross-device / cross-browser resets work.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/callback?next=/reset-password`,
  });
  return { sent: true };
}

// Where the person asking is: the link in the email must bring them back here.
// It used to be NEXT_PUBLIC_APP_URL, which on production still named (or fell
// back to) the old markitup-woad.vercel.app. Supabase only redirects to addresses
// on its allow list (review.apexure.com/**), so it refused that one and dropped
// people on the Site URL's home page — the reset never started. A forged Host
// header gains nothing: the allow list still decides where Supabase will go.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return APP_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
