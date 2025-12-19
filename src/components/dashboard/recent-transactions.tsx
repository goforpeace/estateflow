import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { mockTransactions, mockProjects } from "@/lib/data"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

const recentTransactions = mockTransactions.slice(-5).reverse();

export function RecentTransactions() {
  return (
    <Card>
        <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                An overview of the most recent cash movements.
                </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="/dashboard/transactions">
                View All
                <ArrowUpRight className="h-4 w-4" />
                </Link>
            </Button>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.map((tx) => {
              const project = mockProjects.find(p => p.id === tx.projectId);
              return (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="font-medium">{project?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={tx.type === "Inflow" ? "default" : "destructive"} className={tx.type === "Inflow" ? "bg-green-500/20 text-green-700 hover:bg-green-500/30" : "bg-red-500/20 text-red-700 hover:bg-red-500/30"}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${tx.type === "Inflow" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "Inflow" ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
