import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getVerifiedUserId } from "@/lib/auth/session";
import { getRole, homeFor } from "@/lib/auth/roles";

export default async function NoAccessPage() {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/auth/login");
  const role = await getRole(userId);
  if (role) redirect(homeFor(role));
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-5 text-center">
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-muted-foreground max-w-md">
        Your account has no role assigned, so you can&apos;t use this app yet.
        Contact an administrator.
      </p>
      <LogoutButton />
    </main>
  );
}
