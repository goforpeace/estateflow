import { DollarSign, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ProjectStatus } from "@/components/dashboard/project-status";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title="Total Revenue"
                value="₹1.25 Cr"
                icon={TrendingUp}
                description="+20.1% from last month"
            />
            <StatCard 
                title="Total Expenses"
                value="₹80.5 Lacs"
                icon={TrendingDown}
                description="+12.3% from last month"
            />
            <StatCard 
                title="Net Cash Flow"
                value="₹44.5 Lacs"
                icon={DollarSign}
                description="Current fiscal year"
            />
            <StatCard 
                title="Active Projects"
                value="3"
                icon={Briefcase}
                description="1 project in planning"
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
