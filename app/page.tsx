import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth/session";
import { getRole, homeFor } from "@/lib/auth/roles";

async function RoleRedirect(): Promise<null> {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/auth/login");
  return redirect(homeFor(await getRole(userId)));
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RoleRedirect />
    </Suspense>
  );
}
