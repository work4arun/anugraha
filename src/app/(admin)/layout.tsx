export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced per-page and in middleware; /admin/login stays public.
  return <>{children}</>;
}
