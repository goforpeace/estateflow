'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  ArrowRightLeft,
  Building,
  BrainCircuit,
  Settings,
  Users,
  ShoppingCart,
} from 'lucide-react';
import { Logo } from '../icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/projects', icon: Briefcase, label: 'Projects' },
  { href: '/dashboard/customers', icon: Users, label: 'Customers' },
  { href: '/dashboard/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/dashboard/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  { href: '/dashboard/office-costs', icon: Building, label: 'Office Costs' },
  { href: '/dashboard/forecasting', icon: BrainCircuit, label: 'Forecasting', isNew: true },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-16 items-center border-b px-4 lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Logo className="h-8 w-8" />
            <span className="text-xl">EstateFlow</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                  pathname.startsWith(item.href) && 'bg-muted text-primary'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.isNew && (
                  <Badge className="ml-auto flex h-6 w-16 items-center justify-center rounded-sm bg-accent/20 text-accent-foreground border-accent">
                    AI Beta
                  </Badge>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
             <Link
                href="/dashboard/settings"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                  pathname === "/dashboard/settings" && 'bg-muted text-primary'
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
