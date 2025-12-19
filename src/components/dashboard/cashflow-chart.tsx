'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartTooltipContent, ChartContainer } from "@/components/ui/chart"
import { useFirestore } from "@/firebase"
import { collectionGroup, getDocs, query } from "firebase/firestore"
import { useEffect, useState } from "react"
import { format, subMonths } from "date-fns"
import type { InflowTransaction, OutflowTransaction } from "@/lib/types"

const chartConfig = {
  inflow: {
    label: "Inflow",
    color: "hsl(var(--chart-1))",
  },
  outflow: {
    label: "Outflow",
    color: "hsl(var(--chart-2))",
  },
}

export function CashflowChart() {
  const firestore = useFirestore();
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true);
      try {
        const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'));
        const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));

        const [inflowSnap, outflowSnap] = await Promise.all([
          getDocs(inflowsQuery),
          getDocs(outflowsQuery)
        ]);

        const monthlyData: { [key: string]: { inflow: number; outflow: number } } = {};
        const last6Months = Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), i), 'MMM'));
        last6Months.reverse().forEach(month => {
            monthlyData[month] = { inflow: 0, outflow: 0 };
        });

        inflowSnap.forEach(doc => {
            const data = doc.data() as InflowTransaction;
            const month = format(new Date(data.date), 'MMM');
            if (monthlyData[month]) {
                monthlyData[month].inflow += data.amount;
            }
        });

        outflowSnap.forEach(doc => {
            const data = doc.data() as OutflowTransaction;
            const month = format(new Date(data.date), 'MMM');
            if (monthlyData[month]) {
                monthlyData[month].outflow += data.amount;
            }
        });

        const formattedData = Object.entries(monthlyData).map(([month, values]) => ({
            month,
            ...values,
        }));
        
        setChartData(formattedData);

      } catch (error) {
        console.error("Error fetching chart data: ", error);
      }
      setIsLoading(false);
    };

    fetchChartData();
  }, [firestore]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Overview</CardTitle>
        <CardDescription>Monthly Inflow vs. Outflow (Last 6 Months)</CardDescription>
      </CardHeader>
      <CardContent>
      {isLoading ? (
          <div className="flex justify-center items-center h-[350px]">
            <p>Loading chart data...</p>
          </div>
        ) : (
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
                <XAxis
                dataKey="month"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                />
                <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `৳${value / 100000}L`}
                />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="inflow" fill="hsl(var(--chart-1))" name="Inflow" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" fill="hsl(var(--chart-2))" name="Outflow" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
