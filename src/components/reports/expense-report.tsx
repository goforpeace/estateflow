'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import type { Vendor, Expense, Project, ExpenseItem, ExpenseStatus } from '@/lib/types';
import { exportToCsv } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Download } from 'lucide-react';

const statusOptions: { value: ExpenseStatus; label: string }[] = [
    { value: 'Unpaid', label: 'Unpaid' },
    { value: 'Partially Paid', label: 'Partially Paid' },
    { value: 'Paid', label: 'Paid' },
];

export function ExpenseReport() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'expenseItems')), [firestore]);
  const { data: expenseItems, isLoading: itemsLoading } = useCollection<ExpenseItem>(itemsQuery);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const expensesQuery = query(collection(firestore, 'expenses'));
      const projectsQuery = query(collection(firestore, 'projects'));
      
      const [expensesSnap, projectsSnap, vendorsSnap, itemsSnap] = await Promise.all([
        getDocs(expensesQuery),
        getDocs(projectsQuery),
        getDocs(query(collection(firestore, 'vendors'))),
        getDocs(query(collection(firestore, 'expenseItems'))),
      ]);

      const expenses = expensesSnap.docs.map(doc => doc.data() as Expense);
      const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data().projectName]));
      const vendorsMap = new Map(vendorsSnap.docs.map(d => [d.id, d.data().vendorName]));
      const itemsMap = new Map(itemsSnap.docs.map(d => [d.id, d.data().name]));

      // Filter
      let filteredData = expenses;
      if (dateRange?.from) {
        filteredData = filteredData.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= dateRange.from! && expenseDate <= (dateRange.to || dateRange.from!);
        });
      }
      if (selectedVendorId) {
        filteredData = filteredData.filter(e => e.vendorId === selectedVendorId);
      }
      if (selectedItemId) {
        filteredData = filteredData.filter(e => e.itemId === selectedItemId);
      }
      if (selectedStatus) {
        filteredData = filteredData.filter(e => e.status === selectedStatus);
      }

      // Enrich
      const dataToExport = filteredData.map(e => ({
        'Expense ID': e.expenseId,
        'Date': new Date(e.date).toLocaleDateString(),
        'Vendor': vendorsMap.get(e.vendorId) || 'N/A',
        'Project': projectsMap.get(e.projectId) || 'N/A',
        'Item': itemsMap.get(e.itemId) || 'N/A',
        'Quantity': e.quantity,
        'Price': e.price,
        'Paid Amount': e.paidAmount,
        'Status': e.status,
        'Description': e.description,
      }));

      if (dataToExport.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data to Export',
            description: 'There are no expenses matching the selected criteria.',
        });
        return;
      }

      exportToCsv(dataToExport, `expense_list_${new Date().toISOString().split('T')[0]}.csv`);
      toast({
        title: 'Export Successful',
        description: `${dataToExport.length} expense records have been exported.`,
      });

    } catch (error: any) {
      console.error("Error exporting expense list:", error);
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
        <CardTitle>Expense List Report</CardTitle>
        <CardDescription>
          Export a detailed list of all recorded expenses. Use the filters to refine your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Combobox
            options={vendors?.map(v => ({ value: v.id, label: v.vendorName })) || []}
            value={selectedVendorId}
            onChange={setSelectedVendorId}
            placeholder="Filter by Vendor"
            searchPlaceholder="Search vendors..."
            emptyText="No vendors found."
            disabled={vendorsLoading}
          />
          <Combobox
            options={expenseItems?.map(i => ({ value: i.id, label: i.name })) || []}
            value={selectedItemId}
            onChange={setSelectedItemId}
            placeholder="Filter by Item"
            searchPlaceholder="Search items..."
            emptyText="No items found."
            disabled={itemsLoading}
          />
          <Combobox
            options={statusOptions}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Filter by Status"
          />
        </div>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Exporting...' : 'Export Expense List (CSV)'}
        </Button>
      </CardContent>
    </Card>
  );
}
