'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Vendor, Expense, OutflowTransaction } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

export function VendorReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all necessary data
      const vendorsQuery = query(collection(firestore, 'vendors'));
      const expensesQuery = query(collection(firestore, 'expenses'));
      const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));

      const [vendorsSnap, expensesSnap, outflowsSnap] = await Promise.all([
        getDocs(vendorsQuery),
        getDocs(expensesQuery),
        getDocs(outflowsSnap),
      ]);

      const vendors = vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      const expenses = expensesSnap.docs.map(doc => doc.data() as Expense);
      const outflows = outflowsSnap.docs.map(doc => doc.data() as OutflowTransaction);

      // 2. Process and enrich data
      const dataToExport = vendors.map(vendor => {
        const vendorExpenses = expenses.filter(e => e.vendorId === vendor.id);
        const totalAmount = vendorExpenses.reduce((sum, e) => sum + e.price, 0);

        const vendorOutflows = outflows.filter(o => o.supplierVendor === vendor.vendorName);
        const paidAmount = vendorOutflows.reduce((sum, o) => sum + o.amount, 0);

        return {
          'Vendor Name': vendor.vendorName,
          'Phone Number': vendor.phoneNumber,
          'Enterprise': vendor.enterpriseName,
          'Total Billed Amount': totalAmount,
          'Paid Amount': paidAmount,
          'Due Amount': totalAmount - paidAmount,
        };
      });

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no vendors to export.',
        });
        return;
      }

      exportToCsv(dataToExport, `vendor_list_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} vendor records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting vendor list:", error);
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
        <CardTitle>Vendor List Report</CardTitle>
        <CardDescription>
          Export a comprehensive list of all vendors with their financial summaries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
            This report includes all vendors. Date range filtering is not applicable.
        </p>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Vendor List (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
