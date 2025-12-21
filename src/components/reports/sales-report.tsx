'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import type { Sale, Customer, Project, Flat } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Download } from 'lucide-react';

export function SalesReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all necessary data
      const salesQuery = query(collection(firestore, 'sales'));
      const projectsQuery = query(collection(firestore, 'projects'));
      const customersQuery = query(collection(firestore, 'customers'));
      
      const [salesSnap, projectsSnap, customersSnap] = await Promise.all([
        getDocs(salesQuery),
        getDocs(projectsSnap),
        getDocs(customersSnap),
      ]);

      const sales = salesSnap.docs.map(doc => doc.data() as Sale);
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

      // 2. Filter by date range
      const filteredSales = dateRange?.from ? sales.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= dateRange.from! && saleDate <= (dateRange.to || dateRange.from!);
      }) : sales;

      // 3. Enrich data
      const dataToExport = filteredSales.map(sale => {
        const project = projects.find(p => p.id === sale.projectId);
        const customer = customers.find(c => c.id === sale.customerId);
        const flat = allFlatsMap.get(sale.flatId);

        return {
          'Sale ID': sale.id,
          'Sale Date': new Date(sale.saleDate).toLocaleDateString(),
          'Customer Name': customer?.fullName || 'N/A',
          'Project Name': project?.projectName || 'N/A',
          'Flat Number': flat?.flatNumber || 'N/A',
          'Flat Size (SFT)': flat?.flatSize || 'N/A',
          'Price per SFT': sale.perSftPrice || 0,
          'Parking Charge': sale.parkingCharge || 0,
          'Utility Charge': sale.utilityCharge || 0,
          'Extra Costs': sale.extraCosts?.reduce((sum, cost) => sum + cost.amount, 0) || 0,
          'Total Price': sale.totalPrice,
          'Downpayment': sale.downpayment || 0,
          'Monthly Installment': sale.monthlyInstallment || 0,
          'Note': sale.note || '',
        };
      });

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no sales records matching the selected criteria.',
        });
        return;
      }

      exportToCsv(dataToExport, `sales_list_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} sales records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting sales list:", error);
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
        <CardTitle>Sales List Report</CardTitle>
        <CardDescription>
          Export a detailed list of all sales transactions. Filter by date range to narrow down the results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Sales List (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
