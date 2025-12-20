'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  collectionGroup,
} from 'firebase/firestore';
import type {
  Project,
  Flat,
  Sale,
  InflowTransaction,
  OutflowTransaction,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type ProjectSummaryData = {
  projectName: string;
  totalFlats: number;
  soldFlats: number;
  unsoldFlats: number;
  totalRevenue: number;
  targetSell: number;
  totalInflow: number;
  totalOutflow: number;
  totalExpense: number; // For future use
};

export function ProjectSummary() {
  const firestore = useFirestore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ProjectSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const projectsQuery = useMemoFirebase(
    () => collection(firestore, 'projects'),
    [firestore]
  );
  const { data: projects, isLoading: projectsLoading } =
    useCollection<Project>(projectsQuery);

  useEffect(() => {
    if (!selectedProjectId) {
      setSummary(null);
      return;
    }

    const fetchSummaryData = async () => {
      setIsLoading(true);
      try {
        const projectRef = doc(firestore, 'projects', selectedProjectId);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          setSummary(null);
          setIsLoading(false);
          return;
        }
        const projectData = projectSnap.data() as Project;

        // Fetch flats, sales, inflows, outflows
        const flatsQuery = collection(firestore, `projects/${selectedProjectId}/flats`);
        const salesQuery = query(collection(firestore, 'sales'), where('projectId', '==', selectedProjectId));
        const inflowsQuery = query(collection(firestore, `projects/${selectedProjectId}/inflowTransactions`));
        const outflowsQuery = query(collection(firestore, `projects/${selectedProjectId}/outflowTransactions`));

        const [flatsSnap, salesSnap, inflowsSnap, outflowsSnap] = await Promise.all([
          getDocs(flatsQuery),
          getDocs(salesQuery),
          getDocs(inflowsQuery),
          getDocs(outflowsQuery),
        ]);

        const soldFlats = flatsSnap.docs.filter(d => (d.data() as Flat).status === 'Sold').length;
        const totalRevenue = salesSnap.docs.reduce((sum, doc) => sum + (doc.data() as Sale).totalPrice, 0);
        const totalInflow = inflowsSnap.docs.reduce((sum, doc) => sum + (doc.data() as InflowTransaction).amount, 0);
        const totalOutflow = outflowsSnap.docs.reduce((sum, doc) => sum + (doc.data() as OutflowTransaction).amount, 0);

        setSummary({
          projectName: projectData.projectName,
          totalFlats: projectData.totalFlats,
          soldFlats: soldFlats,
          unsoldFlats: projectData.totalFlats - soldFlats,
          totalRevenue: totalRevenue,
          targetSell: projectData.targetSell,
          totalInflow: totalInflow,
          totalOutflow: totalOutflow,
          totalExpense: totalOutflow, // Placeholder for now
        });

      } catch (error) {
        console.error('Error fetching project summary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaryData();
  }, [selectedProjectId, firestore]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 10000000) {
      return `৳${(value / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(value) >= 100000) {
      return `৳${(value / 100000).toFixed(2)} Lacs`;
    }
    return `৳${value.toLocaleString('en-IN')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary by Project</CardTitle>
        <CardDescription>
          Select a project to see its financial and sales summary.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          onValueChange={value => setSelectedProjectId(value)}
          disabled={projectsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading && (
          <div className="space-y-4 pt-4">
             <Skeleton className="h-8 w-3/4" />
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
             </div>
          </div>
        )}

        {!isLoading && summary && (
          <div className="pt-4">
            <h3 className="text-lg font-semibold mb-4">{summary.projectName}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Flat Status</p>
                    <p><span className="font-bold">{summary.soldFlats}</span> Sold</p>
                    <p><span className="font-bold">{summary.unsoldFlats}</span> Unsold ({summary.totalFlats} Total)</p>
                </div>
                 <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Total Revenue</p>
                    <p className="font-bold">{formatCurrency(summary.totalRevenue)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Target Sell</p>
                    <p className="font-bold">{formatCurrency(summary.targetSell)}</p>
                </div>
                 <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Total Inflow</p>
                    <p className="font-bold text-green-600">{formatCurrency(summary.totalInflow)}</p>
                </div>
                 <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Total Outflow</p>
                    <p className="font-bold text-orange-600">{formatCurrency(summary.totalOutflow)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-muted-foreground">Total Expense</p>
                    <p className="font-bold text-red-600">{formatCurrency(summary.totalExpense)}</p>
                </div>
            </div>
          </div>
        )}
        
        {!isLoading && selectedProjectId && !summary && (
            <div className="pt-4 text-center text-muted-foreground">
                <p>Could not load summary for this project.</p>
            </div>
        )}

        {!selectedProjectId && (
            <div className="pt-4 text-center text-muted-foreground">
                <p>Select a project to view its summary.</p>
            </div>
        )}

      </CardContent>
    </Card>
  );
}
