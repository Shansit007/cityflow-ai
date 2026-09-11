import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";

import { AssistantLauncher } from "@/components/chat/assistant-launcher";
import { CityProvider, CITY_COOKIE_NAME } from "@/components/city/city-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme/theme-provider";
import { getSession } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";

/**
 * Root layout — wraps every page in the app.
 *
 * Responsibilities:
 *   1. load the typeface
 *   2. set the dark-mode class before the first paint (no white flash)
 *   3. provide the theme and city context to the whole tree
 *   4. render the shared header and footer
 */

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "CityFlow AI — Smarter Departures, Smoother Journeys",
    template: "%s · CityFlow AI",
  },
  description:
    "CityFlow AI helps reduce peak traffic by recommending when to travel, before congestion builds up.",
  applicationName: "CityFlow AI",
  keywords: [
    "traffic management",
    "departure time",
    "demand smoothing",
    "smart city",
    "public mobility",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Keeps the browser UI in step with our page background in both themes.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the two pieces of state the server can know about up front.
  // getSession() only verifies the cookie signature — it does not touch the
  // database, so this stays cheap on every page load.
  const cookieStore = await cookies();
  const initialCity = getCity(cookieStore.get(CITY_COOKIE_NAME)?.value);
  const session = await getSession();

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/*
          Runs before anything is painted so a dark-mode user never sees a
          white flash. See THEME_INIT_SCRIPT for what it does.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>

      <body className={`${inter.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <CityProvider initialCityCode={initialCity.code}>
            {/* Keyboard users can jump straight past the header. */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>

            <div className="flex min-h-screen flex-col">
              <SiteHeader
                session={
                  session
                    ? { cityflowId: session.cityflowId, role: session.role }
                    : null
                }
              />

              <main id="main-content" className="flex-1">
                {children}
              </main>

              <SiteFooter />

              {/*
                Saarthi, reachable from every signed-in page.

                Shown to admins as well as commuters — an administrator is also
                a person with a commute, and their account works exactly like
                anybody else's outside the Admin Portal. The launcher hides
                itself on /admin and on the assistant page; see the component.

                Not shown to signed-out visitors: there is nothing useful it
                could do without a travel routine, and a floating button on the
                landing page would just be noise.
              */}
              {session && <AssistantLauncher />}
            </div>
          </CityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
