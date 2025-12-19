"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartTooltipContent, ChartContainer } from "@/components/ui/chart"

const data = [
  { month: "Jan", inflow: 186000, outflow: 80000 },
  { month: "Feb", inflow: 305000, outflow: 200000 },
  { month: "Mar", inflow: 237000, outflow: 120000 },
  { month: "Apr", inflow: 73000, outflow: 190000 },
  { month: "May", inflow: 209000, outflow: 130000 },
  { month: "Jun", inflow: 214000, outflow: 140000 },
]

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Overview</CardTitle>
        <CardDescription>Monthly Inflow vs. Outflow</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
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
                tickFormatter={(value) => `₹${value / 100000}L`}
                />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="inflow" fill="hsl(var(--chart-1))" name="Inflow" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" fill="hsl(var(--chart-2))" name="Outflow" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
