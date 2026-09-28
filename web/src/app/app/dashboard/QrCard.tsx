"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download, QrCode as QrCodeIcon } from "@/components/icons";

/**
 * Renders this account's public companion link as a QR code.
 *
 * The URL is built from window.location.origin so the QR always points at
 * whatever host the dashboard is being served from (localhost, preview,
 * production) without needing a configured site-URL env var.
 *
 * Error correction level H so a center logo / styling can be layered on
 * later without breaking scannability.
 */
export default function QrCard({ slug }: { slug: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const liveUrl = `${window.location.origin}/live/${slug}`;
    setUrl(liveUrl);
    QRCode.toString(liveUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
    }).then(setSvg);
  }, [slug]);

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPng = async () => {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 1024,
      color: { dark: "#111111", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slug}-qr.png`;
    a.click();
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
      <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
        <QrCodeIcon size={11} />
        Companion QR code
      </h2>

      <div className="flex items-start gap-4">
        <div
          className="w-32 h-32 shrink-0 rounded-lg bg-white p-1.5 [&>svg]:w-full [&>svg]:h-full"
          aria-label={`QR code for ${url}`}
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Put this on your slides or bulletin. Anyone who scans it lands on
            your live companion page.
          </p>
          <button
            onClick={copyLink}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-brand transition-colors max-w-full"
            title="Copy link"
          >
            <span className="truncate font-mono">{url || `/live/${slug}`}</span>
            {copied ? <Check size={11} className="shrink-0 text-brand" /> : <Copy size={11} className="shrink-0" />}
          </button>
          <div className="mt-3 flex gap-2">
            <button
              onClick={downloadSvg}
              disabled={!svg}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand/10 border border-brand/30 text-[11px] font-semibold uppercase tracking-wider text-brand hover:bg-brand/20 transition-colors disabled:opacity-50"
            >
              <Download size={11} />
              SVG
            </button>
            <button
              onClick={downloadPng}
              disabled={!svg}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-semibold uppercase tracking-wider hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
            >
              <Download size={11} />
              PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
