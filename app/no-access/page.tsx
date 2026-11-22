import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getVerifiedUserId } from "@/lib/auth/session";

async function NoAccessContent() {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/auth/login");
  return (
    <>
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-muted-foreground max-w-md">
        Your account has no role assigned, so you can&apos;t use this app yet.
        Contact an administrator.
      </p>
      <LogoutButton />
    </>
  );
}

export default function NoAccessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-5 text-center">
      <Suspense fallback={null}>
        <NoAccessContent />
      </Suspense>
    </main>
  );
}
