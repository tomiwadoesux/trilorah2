import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-3">
        Trilorah
      </h1>
      <p className="text-gray-400 max-w-md mb-8">
        The companion that turns Sunday morning into a shareable, searchable, present moment.
      </p>
      <div className="flex gap-3">
        <Link
          href="/app"
          className="px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dim transition"
        >
          Operator login
        </Link>
        <Link
          href="/app/signup"
          className="px-5 py-2.5 rounded-lg border border-white/15 text-sm font-semibold hover:border-brand/40 hover:text-brand transition"
        >
          Create account
        </Link>
      </div>
      <p className="text-[11px] text-gray-600 mt-12">
        Audience? Scan the QR code shown in your service.
      </p>
    </main>
  );
}
