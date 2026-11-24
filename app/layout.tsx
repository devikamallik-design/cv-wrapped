import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Wrapped",
  description: "Upload your CV and see what's actually in it: your verbs, your numbers, your shape.",
};

export const viewport: Viewport = {
  themeColor: "#1B1D12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
