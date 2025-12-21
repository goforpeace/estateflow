'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  variant?:
    | 'default'
    | 'primary'
    | 'accent'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'info'
    | 'danger';
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
}: StatCardProps) {
  const cardClasses = {
    default: 'bg-card text-card-foreground',
    primary: 'bg-primary/10 text-primary-foreground border-primary/20',
    accent: 'bg-accent/10 text-accent-foreground border-accent/20',
    secondary: 'bg-secondary/10 text-secondary-foreground border-secondary/20',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    info: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const iconClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    accent: 'text-accent',
    secondary: 'text-secondary-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    info: 'text-sky-500',
    danger: 'text-red-500',
  };

  const valueClasses = {
     default: 'text-foreground',
    primary: 'text-primary',
    accent: 'text-accent',
    secondary: 'text-secondary-foreground',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-sky-600',
    danger: 'text-red-600',
  }

  return (
    <Card className={cn(cardClasses[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconClasses[variant])} />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueClasses[variant])}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
