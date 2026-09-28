import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
const displayFont = localFont({
  src: "../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2",
  variable: "--font-display-face",
  display: "swap",
  weight: "400",
});
const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans-face",
  weight: ["400", "600", "700", "900"],
  display: "swap",
});
import "./globals.css";
import { siteUrl } from "@/lib/http";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { getToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  title: "Big Mama Fitness",
  description:
    "Big Mama Fitness. A beginner-friendly Afro Dance Fitness experience with Brenda in Nanaimo.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let initialToken: string | null | undefined;
  try {
    initialToken = await getToken();
  } catch {
    initialToken = null;
  }
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${sansFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream font-sans text-ink selection:bg-sun">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
        >
          Skip to content
        </a>
        <ConvexClientProvider initialToken={initialToken}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
