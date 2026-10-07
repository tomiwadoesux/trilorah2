import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import MicClient from "./MicClient";
import "./mic.css";

export const metadata: Metadata = {
  title: "Trilorah · Phone microphone",
  description: "Use this phone as the microphone for Trilorah on the church Wi-Fi.",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020608",
};

export default function MicPage() {
  return (
    <Suspense fallback={null}>
      <MicClient />
    </Suspense>
  );
}
