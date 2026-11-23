import { RoleShell } from '@/components/role-shell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="student">{children}</RoleShell>
}
