import { RoleShell } from "@/components/role-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleShell role="admin">{children}</RoleShell>;
}
