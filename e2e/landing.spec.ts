import { test, expect, type Page } from "@playwright/test";

// The marketing page at "/". A fresh Playwright context has no session, so
// these run as a signed-out visitor; signed-in redirects are unit-tested in
// lib/supabase/middleware.test.ts.

const SECTION_HEADINGS = [
  "Same comment. None of the chaos.",
  "Three steps. Zero chasing.",
  "New version. Same conversation.",
  "The busywork, handled.",
  "Agencies stopped chasing feedback.",
  "Questions, answered.",
  "Your next round of feedback starts here.",
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // The dev server's hot-reload socket is not part of the page.
    if (m.type() === "error" && !m.text().includes("/_next/webpack-hmr") && !m.text().includes("/_next/hmr")) {
      errors.push(m.text());
    }
  });
  return errors;
}

test.describe("landing page", () => {
  test("signed-out visitors get the landing page with working calls to action", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Don’t explain it. Pin it.");
    for (const link of await page.getByRole("link", { name: /^Start free/ }).all()) {
      await expect(link).toHaveAttribute("href", "/signup");
    }
    for (const link of await page.getByRole("link", { name: "Log in" }).all()) {
      await expect(link).toHaveAttribute("href", "/login");
    }
    expect(errors).toEqual([]);
  });

  test("every section is readable with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto("/");

    for (const name of SECTION_HEADINGS) {
      const heading = page.getByRole("heading", { name, exact: true });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    // The first feature step, normally revealed by animation, is simply there.
    await page.evaluate(() => {
      const track = document.querySelector("#features")!;
      window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY + 10);
    });
    await expect(page.getByText("Put it exactly there.").first()).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test("a visitor can drop their own pin on the demo", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator(".lp-film-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await canvas.click({ position: { x: 200, y: 160 } });
    await expect(page.getByRole("status")).toContainText("That’s all it takes");
    await expect(page.getByRole("button", { name: "Play the demo" })).toBeVisible();
  });

  test("before and after merges the mess into MarkItUp and ends resolved", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expect(page.getByText("Screenshots, scribbles, long emails and “which logo?”")).toBeVisible();
    // Scroll to the end of the sticky scene, where the app has come out of the
    // folder and the comment has played out.
    await page.evaluate(() => {
      const track = document.querySelector(".lp-ba-track") as HTMLElement;
      const r = track.getBoundingClientRect();
      window.scrollTo(0, r.bottom + window.scrollY - window.innerHeight);
    });
    const app = page.locator(".lp-ba-new");
    await expect(app).toHaveCSS("opacity", "1", { timeout: 8000 });
    await expect(app.getByText("Done in v2.")).toBeVisible();
    await expect(app.locator(".lp-ba-resolved")).toHaveCSS("opacity", "1", { timeout: 8000 });
    await expect(app.locator(".lp-ba-pin")).toHaveCSS("background-color", "rgb(47, 158, 98)");
    await expect(page.locator(".lp-ba-folder-front")).toHaveCSS("opacity", "0");
    expect(errors).toEqual([]);
  });

  test("a visitor can comment anywhere on the hero, by click or by drag", async ({ page }) => {
    await page.goto("/");
    const stage = page.locator(".lp-hero-stage");

    // A click drops a pin and opens the composer there.
    await stage.click({ position: { x: 80, y: 300 } });
    const input = page.getByLabel("Your comment");
    await input.fill("Make the headline bolder");
    await input.press("Enter");
    await expect(page.getByLabel("Comment 2: Make the headline bolder")).toBeVisible();
    await expect(page.getByText("Make the headline bolder")).toBeVisible();

    // A drag marks an area instead.
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 420);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 470, { steps: 6 });
    await page.mouse.up();
    await page.getByLabel("Your comment").fill("This whole area");
    await page.getByLabel("Your comment").press("Enter");
    await expect(page.getByLabel("Comment 3: This whole area")).toBeVisible();
  });

  test("the footer links go somewhere real, including the legal pages", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "https://www.apexure.com/privacy/");
    await expect(footer.getByRole("link", { name: "info@apexure.com" })).toHaveAttribute("href", "mailto:info@apexure.com");
    await footer.getByRole("link", { name: "Terms and conditions" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms and conditions");
  });

  // Clicking straight after load jumps the page to the bottom before the
  // animations finish setting up, which once crashed ScrollTrigger.
  test("the FAQ opens one answer at a time", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    const first = page.locator("#faq details").nth(0);
    const second = page.locator("#faq details").nth(1);
    await expect(first).toHaveAttribute("open", "");
    await second.locator("summary").click();
    await expect(second).toHaveAttribute("open", "");
    await expect(first).not.toHaveAttribute("open", "");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Don’t explain it. Pin it.");
    expect(errors).toEqual([]);
  });
});
