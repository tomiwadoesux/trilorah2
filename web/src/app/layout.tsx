import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteScroll } from '@/components/SiteScroll';
import 'lenis/dist/lenis.css';
import "./globals.css";

const headingFont = localFont({
  /* Geist, not TT Hoves Pro: the copy we hold is TypeType's trial, and its
     licence (fonts/TypeType-Trial-License.pdf, clause 2b) bars public webpages. */
  src: "../../public/brand/fonts/geist-variable.woff2",
  variable: "--font-heading",
  weight: "100 900",
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
