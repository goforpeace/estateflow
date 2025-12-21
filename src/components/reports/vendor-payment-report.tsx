'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Vendor, OutflowTransaction, Project } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Download } from 'lucide-react';

export function VendorPaymentReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));
      const [outflowsSnap, projectsSnap] = await Promise.all([
        getDocs(outflowsQuery),
        getDocs(query(collection(firestore, 'projects'))),
      ]);

      const outflows = outflowsSnap.docs.map(doc => doc.data() as OutflowTransaction);
      const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data().projectName]));

      // Filter
      let filteredData = outflows;
      if (dateRange?.from) {
        filteredData = filteredData.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= dateRange.from! && paymentDate <= (dateRange.to || dateRange.from!);
        });
      }
      if (selectedVendor) {
        filteredData = filteredData.filter(p => p.supplierVendor === selectedVendor);
      }
      if (selectedProjectId) {
        filteredData = filteredData.filter(p => p.projectId === selectedProjectId);
      }

      // Enrich
      const dataToExport = filteredData.map(p => ({
        'Date': new Date(p.date).toLocaleDateString(),
        'Vendor': p.supplierVendor,
        'Project': p.projectId ? projectsMap.get(p.projectId) : 'Office/General',
        'Expense ID': p.expenseId || 'N/A',
        'Amount': p.amount,
        'Method': p.paymentMethod,
        'Reference': p.reference,
        'Description': p.description,
      }));

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no vendor payments matching the selected criteria.',
        });
        return;
      }

      exportToCsv(dataToExport, `vendor_payments_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} vendor payment records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting vendor payments:", error);
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
        <CardTitle>Vendor Payments Report</CardTitle>
        <CardDescription>
          Export a detailed log of all payments made to vendors. Use the filters to refine your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Combobox
            options={vendors?.map(v => ({ value: v.vendorName, label: v.vendorName })) || []}
            value={selectedVendor}
            onChange={setSelectedVendor}
            placeholder="Filter by Vendor"
            searchPlaceholder="Search vendors..."
            emptyText="No vendors found."
            disabled={vendorsLoading}
          />
          <Combobox
            options={projects?.map(p => ({ value: p.id, label: p.projectName })) || []}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="Filter by Project"
            searchPlaceholder="Search projects..."
            emptyText="No projects found."
            disabled={projectsLoading}
          />
        </div>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Vendor Payments (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
