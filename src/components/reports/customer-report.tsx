'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Customer, Sale, InflowTransaction, Project, Flat } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Download } from 'lucide-react';

export function CustomerReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all necessary data
      const customersQuery = query(collection(firestore, 'customers'));
      const salesQuery = query(collection(firestore, 'sales'));
      const projectsQuery = query(collection(firestore, 'projects'));
      const inflowsQuery = query(collectionGroup(firestore, 'inflowTransactions'));

      const [customersSnap, salesSnap, projectsSnap, inflowsSnap] = await Promise.all([
        getDocs(customersQuery),
        getDocs(salesQuery),
        getDocs(projectsQuery),
        getDocs(inflowsQuery),
      ]);

      const customers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      const sales = salesSnap.docs.map(doc => doc.data() as Sale);
      const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      const inflows = inflowsSnap.docs.map(doc => doc.data() as InflowTransaction);
      
      const projectsMap = new Map(projects.map(p => [p.id, p]));
      
      const allFlatsMap = new Map<string, Flat>();
        for (const project of projects) {
            const flatsQuery = query(collection(firestore, `projects/${project.id}/flats`));
            const flatsSnap = await getDocs(flatsQuery);
            flatsSnap.forEach(doc => {
                allFlatsMap.set(doc.id, doc.data() as Flat);
            });
        }


      // 2. Process and enrich data
      let processedData = customers.map(customer => {
        const customerSales = sales.filter(s => s.customerId === customer.id);
        const totalAmount = customerSales.reduce((sum, s) => sum + s.totalPrice, 0);

        const customerPayments = inflows.filter(p => p.customerId === customer.id);
        const paidAmount = customerPayments.reduce((sum, p) => sum + p.amount, 0);

        const projectNames = [...new Set(customerSales.map(s => projectsMap.get(s.projectId)?.projectName))].filter(Boolean).join(', ');
        const flatNumbers = [...new Set(customerSales.map(s => allFlatsMap.get(s.flatId)?.flatNumber))].filter(Boolean).join(', ');

        return {
          ...customer,
          totalAmount,
          paidAmount,
          dueAmount: totalAmount - paidAmount,
          projectName: projectNames,
          flatNumber: flatNumbers,
        };
      });

      // 3. Filter by date range (if provided) based on customer creation or sales date - let's assume we don't filter customers by date for this report.
      // If filtering is needed, we'd need to define what date to filter on (e.g., customer join date).
      // For now, exporting all customers.

      // 4. Format for CSV
      const dataToExport = processedData.map(c => ({
        'Customer Name': c.fullName,
        'Mobile': c.mobile,
        'Address': c.address,
        'NID Number': c.nidNumber,
        'Project': c.projectName,
        'Flat': c.flatNumber,
        'Total Amount': c.totalAmount,
        'Paid Amount': c.paidAmount,
        'Due Amount': c.dueAmount,
      }));

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no customers matching the selected criteria.',
        });
        return;
      }

      exportToCsv(dataToExport, `customer_list_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} customer records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting customer list:", error);
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
        <CardTitle>Customer List Report</CardTitle>
        <CardDescription>
          Export a comprehensive list of all customers, including their financial summary and associated properties.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
            This report includes all customers. Date range filtering is not applicable for this report.
        </p>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Customer List (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
