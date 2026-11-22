import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { requireRolePage } from "@/lib/auth/guards";
import type { AppRole } from "@/lib/auth/roles";

async function GuardedShell({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  await requireRolePage(role);
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-5">{children}</main>
    </>
  );
}

export function RoleShell({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={null}>
        <GuardedShell role={role}>{children}</GuardedShell>
      </Suspense>
    </div>
  );
}
