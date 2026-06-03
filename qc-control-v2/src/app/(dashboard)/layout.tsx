import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Toaster } from 'react-hot-toast';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header userName={session.user.name} onSignOut={() => {}} />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">{children}</main>
      <footer className="h-8 border-t border-border px-6 flex items-center justify-between text-xs text-on-surface-variant">
        <span>QC Control v2</span>
        <span>Coagulação</span>
      </footer>
      <Toaster position="top-right" />
    </div>
  );
}
