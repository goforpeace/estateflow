'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Customer, InflowTransaction, Project, Flat } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Download } from 'lucide-react';

export function PaymentLogReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const customersQuery = useMemoFirebase(() => query(collection(firestore, 'customers')), [firestore]);
  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'));
      const [inflowsSnap, projectsSnap, customersSnap] = await Promise.all([
        getDocs(inflowsQuery),
        getDocs(query(collection(firestore, 'projects'))),
        getDocs(query(collection(firestore, 'customers'))),
      ]);

      const inflows = inflowsSnap.docs.map(doc => doc.data() as InflowTransaction);
      const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      const customers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      
      const allFlatsMap = new Map<string, Flat>();
        for (const project of projects) {
            const flatsQuery = query(collection(firestore, `projects/${project.id}/flats`));
            const flatsSnap = await getDocs(flatsQuery);
            flatsSnap.forEach(doc => {
                allFlatsMap.set(doc.id, doc.data() as Flat);
            });
        }

      // Filter
      let filteredData = inflows;
      if (dateRange?.from) {
        filteredData = filteredData.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= dateRange.from! && paymentDate <= (dateRange.to || dateRange.from!);
        });
      }
      if (selectedProjectId) {
        filteredData = filteredData.filter(p => p.projectId === selectedProjectId);
      }
      if (selectedCustomerId) {
        filteredData = filteredData.filter(p => p.customerId === selectedCustomerId);
      }

      // Enrich
      const dataToExport = filteredData.map(p => {
        const customer = customers.find(c => c.id === p.customerId);
        const project = projects.find(proj => proj.id === p.projectId);
        const flat = allFlatsMap.get(p.flatId);
        return {
          'Receipt ID': p.receiptId,
          'Date': new Date(p.date).toLocaleDateString(),
          'Customer': customer?.fullName || 'N/A',
          'Project': project?.projectName || 'N/A',
          'Flat': flat?.flatNumber || 'N/A',
          'Amount': p.amount,
          'Method': p.paymentMethod,
          'Purpose': p.paymentPurpose === 'Other' ? p.otherPurpose : p.paymentPurpose,
          'Reference': p.reference,
        };
      });

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no payment records matching the selected criteria.',
        });
        return;
      }

      exportToCsv(dataToExport, `payment_logs_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} payment records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting payment logs:", error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'An error occurred while generating the report. ' + error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Logs Report</CardTitle>
        <CardDescription>
          Export a detailed log of all payments received from customers. Use the filters to refine your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Combobox
            options={projects?.map(p => ({ value: p.id, label: p.projectName })) || []}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="Filter by Project"
            searchPlaceholder="Search projects..."
            emptyText="No projects found."
            disabled={projectsLoading}
          />
          <Combobox
            options={customers?.map(c => ({ value: c.id, label: c.fullName })) || []}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            placeholder="Filter by Customer"
            searchPlaceholder="Search customers..."
            emptyText="No customers found."
            disabled={customersLoading}
          />
        </div>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Payment Logs (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
