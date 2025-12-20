'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Truck,
  ShoppingCart,
  DollarSign,
  Receipt,
  Banknote,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Logo } from '../icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/projects', icon: Briefcase, label: 'Projects' },
  { href: '/dashboard/customers', icon: Users, label: 'Customers' },
  { href: '/dashboard/vendors', icon: Truck, label: 'Vendors' },
  { href: '/dashboard/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/dashboard/add-payment', icon: DollarSign, label: 'Add Payment' },
  { href: '/dashboard/expense', icon: Receipt, label: 'Add Expense' },
  { href: '/dashboard/make-payment', icon: Banknote, label: 'Make Payment' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

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
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 gap-2">
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
              <Button variant="ghost" className="justify-start px-3" onClick={handleLogout}>
                 <LogOut className="h-4 w-4 mr-3" />
                 Logout
              </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
