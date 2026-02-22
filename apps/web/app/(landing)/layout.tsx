export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b p-4">CompraZap</header>
      <main>{children}</main>
    </div>
  );
}
