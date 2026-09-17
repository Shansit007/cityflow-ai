import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CityFlow AI",
  description:
    "Departure-time coordination that keeps vehicle inflow within each road segment's capacity.",
};

/**
 * Runs before the first paint, so a reader who chose light on a dark device never sees
 * a flash of the theme they rejected. It has to be inline and blocking: anything that
 * waits for hydration has already painted the wrong colours by the time it runs.
 */
const THEME_SCRIPT = `
try {
  var choice = localStorage.getItem("cityflow-theme");
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
  }
} catch (error) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
