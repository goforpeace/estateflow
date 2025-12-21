'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Customer, Sale, InflowTransaction, Project, Flat } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

export function CustomerReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all necessary data sets concurrently.
      const [customersSnap, salesSnap, projectsSnap, inflowsSnap] = await Promise.all([
        getDocs(collection(firestore, 'customers')),
        getDocs(collection(firestore, 'sales')),
        getDocs(collection(firestore, 'projects')),
        getDocs(collectionGroup(firestore, 'inflowTransactions')),
      ]);

      const customers = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      const sales = salesSnap.docs.map(doc => doc.data() as Sale);
      const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      const inflows = inflowsSnap.docs.map(doc => doc.data() as InflowTransaction);

      // 2. Create efficient lookup maps for projects and later for flats.
      const projectsMap = new Map(projects.map(p => [p.id, p.projectName]));
      
      // 3. Create a complete map of all flats from all projects.
      const allFlatsMap = new Map<string, Flat>();
      for (const project of projects) {
          const flatsQuery = query(collection(firestore, `projects/${project.id}/flats`));
          const flatsSnap = await getDocs(flatsQuery);
          flatsSnap.forEach(doc => {
              allFlatsMap.set(doc.id, doc.data() as Flat);
          });
      }
      
      // 4. Pre-calculate financial totals for each customer.
      const customerSalesTotals = new Map<string, number>();
      for (const sale of sales) {
          const currentTotal = customerSalesTotals.get(sale.customerId) || 0;
          customerSalesTotals.set(sale.customerId, currentTotal + sale.totalPrice);
      }

      const customerPaidTotals = new Map<string, number>();
      for (const inflow of inflows) {
          const currentTotal = customerPaidTotals.get(inflow.customerId) || 0;
          customerPaidTotals.set(inflow.customerId, currentTotal + inflow.amount);
      }

      // 5. Process and enrich customer data for the final report.
      const processedData = customers.map(customer => {
        const customerSales = sales.filter(s => s.customerId === customer.id);
        
        const projectNames = [...new Set(customerSales.map(s => projectsMap.get(s.projectId)))].filter(Boolean).join(', ');
        const flatNumbers = [...new Set(customerSales.map(s => allFlatsMap.get(s.flatId)?.flatNumber))].filter(Boolean).join(', ');

        const totalAmount = customerSalesTotals.get(customer.id) || 0;
        const paidAmount = customerPaidTotals.get(customer.id) || 0;
        const dueAmount = totalAmount - paidAmount;

        return {
          fullName: customer.fullName,
          mobile: customer.mobile,
          address: customer.address,
          nidNumber: customer.nidNumber,
          projectName: projectNames,
          flatNumber: flatNumbers,
          totalAmount: totalAmount,
          paidAmount: paidAmount,
          dueAmount: dueAmount,
        };
      });

      // 6. Format for CSV export.
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
            description: 'There are no customers to export.',
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
