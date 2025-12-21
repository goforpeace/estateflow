
'use client';

import { DollarSign, Briefcase, TrendingUp, TrendingDown, ArrowLeftRight, Banknote, Landmark } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { ProjectStatus } from "@/components/dashboard/project-status";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { InflowTransaction, OutflowTransaction, Project, Sale, Expense, OperatingCost } from "@/lib/types";
import { ProjectSummary } from "@/components/dashboard/project-summary";
import { CustomerSummary } from "@/components/dashboard/customer-summary";


export default function DashboardPage() {
  const firestore = useFirestore();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    totalExpenses: 0,
    currentMonthOperatingCost: 0,
    lastMonthOperatingCost: 0,
    totalOperatingCost: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const projectsQuery = useMemoFirebase(() => collection(firestore, "projects"), [firestore]);
  const { data: projects } = useCollection<Project>(projectsQuery);
  
  const operatingCostsQuery = useMemoFirebase(() => collection(firestore, "operatingCosts"), [firestore]);
  const { data: operatingCosts } = useCollection<OperatingCost>(operatingCostsQuery);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const salesQuery = query(collection(firestore, 'sales'));
        const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'));
        const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));
        const expensesQuery = query(collection(firestore, 'expenses'));

        const [salesSnap, inflowSnap, outflowSnap, expensesSnap] = await Promise.all([
          getDocs(salesQuery),
          getDocs(inflowsQuery),
          getDocs(outflowsQuery),
          getDocs(expensesQuery),
        ]);

        const totalRevenue = salesSnap.docs.reduce((sum, doc) => sum + (doc.data() as Sale).totalPrice, 0);
        const totalInflow = inflowSnap.docs.reduce((sum, doc) => sum + (doc.data() as InflowTransaction).amount, 0);
        const totalOutflow = outflowSnap.docs.reduce((sum, doc) => sum + (doc.data() as OutflowTransaction).amount, 0);
        const totalExpenses = expensesSnap.docs.reduce((sum, doc) => sum + (doc.data() as Expense).price, 0);

        setStats(prev => ({
          ...prev,
          totalRevenue,
          totalInflow,
          totalOutflow,
          netCashFlow: totalInflow - totalOutflow,
          totalExpenses,
        }));

      } catch (error) {
        console.error("Error fetching main stats: ", error);
      }
      setIsLoading(false);
    }
    fetchStats();
  }, [firestore]);

  useEffect(() => {
    if (operatingCosts) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const currentMonthCosts = operatingCosts.filter(cost => {
        const costDate = new Date(cost.date);
        return costDate.getFullYear() === currentYear && costDate.getMonth() === currentMonth;
      }).reduce((sum, cost) => sum + cost.amount, 0);

      const lastMonthCosts = operatingCosts.filter(cost => {
        const costDate = new Date(cost.date);
        return costDate.getFullYear() === lastMonthYear && costDate.getMonth() === lastMonth;
      }).reduce((sum, cost) => sum + cost.amount, 0);
      
      const totalOperatingCost = operatingCosts.reduce((sum, cost) => sum + cost.amount, 0);

      setStats(prev => ({
        ...prev,
        currentMonthOperatingCost: currentMonthCosts,
        lastMonthOperatingCost: lastMonthCosts,
        totalOperatingCost: totalOperatingCost,
      }));
    }
  }, [operatingCosts]);
  
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
  const grossProfit = stats.totalRevenue - stats.totalExpenses;
  const actualProfit = stats.totalRevenue - (stats.totalExpenses + stats.totalOperatingCost);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <StatCard 
                title="Total Project Expenses"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalExpenses)}
                icon={DollarSign}
                description="Total recorded project expenses"
            />
            <StatCard 
                title="Total Operating Cost"
                value={isLoading ? "Loading..." : formatCurrency(stats.totalOperatingCost)}
                icon={Landmark}
                description={`This Month: ${formatCurrency(stats.currentMonthOperatingCost)}`}
            />
            <StatCard 
                title="Gross Profit"
                value={isLoading ? "Loading..." : formatCurrency(grossProfit)}
                icon={TrendingUp}
                description="Total Revenue - Project Expenses"
            />
             <StatCard 
                title="Actual Profit"
                value={isLoading ? "Loading..." : formatCurrency(actualProfit)}
                icon={DollarSign}
                description="Revenue - (Proj. + Op. Expenses)"
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
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <ProjectSummary />
            <CustomerSummary />
        </div>
    </div>
  );
}
