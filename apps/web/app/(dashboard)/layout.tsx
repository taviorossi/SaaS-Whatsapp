export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-gray-50 p-4">
        <nav className="space-y-2">
          <a href="/overview" className="block rounded px-3 py-2 hover:bg-gray-200">
            Overview
          </a>
          <a href="/users" className="block rounded px-3 py-2 hover:bg-gray-200">
            Usuários
          </a>
          <a href="/conversations" className="block rounded px-3 py-2 hover:bg-gray-200">
            Conversas
          </a>
          <a href="/billing" className="block rounded px-3 py-2 hover:bg-gray-200">
            Faturamento
          </a>
          <a href="/settings" className="block rounded px-3 py-2 hover:bg-gray-200">
            Configurações
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
