"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/app");
        router.refresh();
      }}
      className="text-xs text-gray-500 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
