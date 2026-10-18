import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteScroll } from '@/components/SiteScroll';
import 'lenis/dist/lenis.css';
import "./globals.css";

const headingFont = localFont({
  src: "./fonts/tt-hoves-pro-variable.woff2",
  variable: "--font-heading",
  weight: "50 900",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trilorah",
  description:
    "Live verses, transcript, and notes for your church service — straight to your phone.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={headingFont.variable}>
      <body><SiteScroll />{children}</body>
    </html>
  );
}
