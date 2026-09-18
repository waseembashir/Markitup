import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { TopProgress } from "@/components/ui/TopProgress";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarkItUp — visual feedback for Apexure",
  description:
    "Upload files and collect pinned, contextual feedback from clients directly on the design.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The inline script below sets the dark class on this very
    // element before React hydrates, so the saved theme is applied on the first
    // paint instead of flashing the default. React then finds attributes its own
    // render did not produce and reports a hydration mismatch — and may strip
    // them back off, visibly resetting the theme it just restored.
    //
    // suppressHydrationWarning is the sanctioned way to say "this element is
    // intentionally changed before hydration". It applies to this element only,
    // not to the tree beneath it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            // Accent colours were removed; a saved `ui-accent` is deliberately
            // ignored so nobody stays stuck on a colour they can no longer change.
            __html: `try{if(localStorage.getItem('ui-mode')==='dark')document.documentElement.classList.add('dark');}catch(_){}`,
          }}
        />
        <TopProgress />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
