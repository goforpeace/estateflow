'use client';

import { DollarSign, Briefcase, TrendingUp, TrendingDown, ArrowLeftRight, Banknote } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ProjectStatus } from "@/components/dashboard/project-status";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, getDocs, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { InflowTransaction, OutflowTransaction, Project, Sale } from "@/lib/types";

export default function DashboardPage() {
  const firestore = useFirestore();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const projectsQuery = useMemoFirebase(() => collection(firestore, "projects"), [firestore]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const salesQuery = query(collection(firestore, 'sales'));
        const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'));
        const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));

        const [salesSnap, inflowSnap, outflowSnap] = await Promise.all([
          getDocs(salesQuery),
          getDocs(inflowsQuery),
          getDocs(outflowsQuery)
        ]);

        const totalRevenue = salesSnap.docs.reduce((sum, doc) => sum + (doc.data() as Sale).totalPrice, 0);
        const totalInflow = inflowSnap.docs.reduce((sum, doc) => sum + (doc.data() as InflowTransaction).amount, 0);
        const totalOutflow = outflowSnap.docs.reduce((sum, doc) => sum + (doc.data() as OutflowTransaction).amount, 0);

        setStats({
          totalRevenue,
          totalInflow,
          totalOutflow,
          netCashFlow: totalInflow - totalOutflow,
        });

      } catch (error) {
        console.error("Error fetching stats: ", error);
      }
      setIsLoading(false);
    }
    fetchStats();
  }, [firestore]);
  
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 10000000) {
      return `৳${(value / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(value) >= 100000) {
      return `৳${(value / 100000).toFixed(2)} Lacs`;
    }
    return `৳${value.toLocaleString('en-IN')}`;
  };

  const activeProjects = projects?.filter(p => p.status === 'Ongoing').length || 0;
  const planningProjects = projects?.filter(p => p.status === 'Planning').length || 0;

  return (
    <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title="Total Revenue"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalRevenue)}
                icon={Banknote}
                description="Total value of all sales contracts"
            />
            <StatCard 
                title="Total Inflow"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalInflow)}
                icon={TrendingUp}
                description="Total cash received"
            />
            <StatCard 
                title="Total Outflow"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalOutflow)}
                icon={TrendingDown}
                description="Total cash paid out"
            />
            <StatCard 
                title="Net Cash Flow"
                value={isLoading ? "Loading..." : formatCurrency(stats.netCashFlow)}
                icon={ArrowLeftRight}
                description="Inflow - Outflow"
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <StatCard 
                title="Total Expenses"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalOutflow)}
                icon={DollarSign}
                description="Total recorded expenses"
            />
            <StatCard 
                title="Active Projects"
                value={projects ? activeProjects.toString() : '...'}
                icon={Briefcase}
                description={projects ? `${planningProjects} project(s) in planning` : '...'}
            />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="lg:col-span-4">
                <CashflowChart />
            </div>
            <div className="lg:col-span-3">
                <ProjectStatus />
            </div>
        </div>
        <div>
          <RecentTransactions />
        </div>
    </div>
  );
}
