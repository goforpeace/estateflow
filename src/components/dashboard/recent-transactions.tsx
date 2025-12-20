'use client';

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
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowUpRight, Ban } from "lucide-react"
import { useFirestore } from "@/firebase";
import { collection, getDocs, limit, orderBy, query, collectionGroup } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { InflowTransaction, OutflowTransaction, Project } from "@/lib/types";

type CombinedTransaction = (InflowTransaction | OutflowTransaction) & { type: 'Inflow' | 'Outflow', projectName: string };

export function RecentTransactions() {
  const firestore = useFirestore();
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const projectsRef = collection(firestore, 'projects');
        const projectsSnap = await getDocs(projectsRef);
        const projectsData = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        const projectMap = new Map(projectsData.map(p => [p.id, p.projectName]));

        const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'), orderBy('date', 'desc'), limit(5));
        const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'), orderBy('date', 'desc'), limit(5));
        
        const [inflowSnap, outflowSnap] = await Promise.all([
          getDocs(inflowsQuery),
          getDocs(outflowsQuery)
        ]);

        const combined: CombinedTransaction[] = [];

        inflowSnap.forEach(doc => {
          const data = doc.data() as InflowTransaction;
          combined.push({
            ...data,
            id: doc.id,
            type: 'Inflow',
            projectName: projectMap.get(data.projectId) || 'Unknown Project'
          });
        });

        outflowSnap.forEach(doc => {
          const data = doc.data() as OutflowTransaction;
          combined.push({
            ...data,
            id: doc.id,
            type: 'Outflow',
            projectName: data.projectId ? projectMap.get(data.projectId) || 'Unknown Project' : 'Office Expense'
          });
        });
        
        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setTransactions(combined.slice(0, 5));

      } catch (error) {
        console.error("Error fetching transactions: ", error);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, [firestore]);


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
      {isLoading && (
          <div className="flex justify-center items-center h-40">
            <p>Loading transactions...</p>
          </div>
        )}
        {!isLoading && !transactions?.length && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                <Ban className="h-10 w-10 mb-2" />
                <p>No transactions found.</p>
            </div>
        )}
        {!isLoading && transactions && transactions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div className="font-medium">{tx.projectName}</div>
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
                      {tx.type === "Inflow" ? '+' : '-'}৳{tx.amount.toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

    