import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Wrapped",
  description: "Upload your CV and see what's actually in it: your verbs, your numbers, your shape.",
};

export const viewport: Viewport = {
  themeColor: "#F2EFE8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
