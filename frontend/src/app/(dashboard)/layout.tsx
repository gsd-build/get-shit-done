'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useOpenAlertCount } from '@/hooks/use-alerts';

interface NavItem {
  name: string;
  href: string;
  showBadge?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/overview' },
  { name: 'Sources', href: '/sources' },
  { name: 'Profiles', href: '/profiles' },
  { name: 'Rules', href: '/rules' },
  { name: 'Validations', href: '/validations' },
  { name: 'Alerts', href: '/alerts', showBadge: true },
  { name: 'Lineage', href: '/lineage' },
];

function NavLink({ item, isActive, badgeCount }: { item: NavItem; isActive: boolean; badgeCount?: number }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <span>{item.name}</span>
      {item.showBadge && badgeCount !== undefined && badgeCount > 0 && (
        <span
          className={cn(
            'ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium',
            isActive
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-red-100 text-red-800'
          )}
        >
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: alertCount } = useOpenAlertCount();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/40">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-lg font-semibold">Data Foundations</h1>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.name}
                item={item}
                isActive={isActive}
                badgeCount={item.showBadge ? alertCount : undefined}
              />
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
