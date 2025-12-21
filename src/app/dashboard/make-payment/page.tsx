'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDocs, runTransaction, collectionGroup, getDoc, limit, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import type { Vendor, Expense, OutflowTransaction, Project, ExpenseItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Ban, MoreHorizontal, Search, Pencil, Trash2, Download, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { exportToCsv } from '@/lib/csv';
import { OutflowDetails } from '@/components/dashboard/payments/outflow-details';
import { EditOutflowForm } from '@/components/dashboard/payments/edit-outflow-form';

const makePaymentFormSchema = z.object({
  vendorId: z.string().min(1, { message: 'Please select a vendor.' }),
  expenseId: z.string().min(1, { message: 'Please select an expense.' }),
  amountToPay: z.coerce.number().min(1, { message: 'Amount must be greater than 0.' }),
  paymentDate: z.string().min(1, { message: 'Payment date is required.' }),
  paymentMethod: z.enum(['Cash', 'Cheque', 'Bank Transfer']),
  reference: z.string().optional(),
});

type MakePaymentFormValues = z.infer<typeof makePaymentFormSchema>;

export type EnrichedOutflow = OutflowTransaction & {
    projectName?: string;
    itemName?: string;
};

const PAYMENTS_PER_PAGE = 10;

export default function MakePaymentPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [unpaidExpenses, setUnpaidExpenses] = useState<Expense[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDataDirty, setIsDataDirty] = useState(true);
  const [outflowTransactions, setOutflowTransactions] = useState<EnrichedOutflow[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<EnrichedOutflow | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);


  // Data for forms
  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const form = useForm<MakePaymentFormValues>({
    resolver: zodResolver(makePaymentFormSchema),
    defaultValues: {
      vendorId: '',
      expenseId: '',
      amountToPay: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      reference: '',
    },
  });

  const vendorId = form.watch('vendorId');
  const expenseId = form.watch('expenseId');

  // Fetch unpaid expenses for the selected vendor
  useEffect(() => {
    form.setValue('expenseId', '');
    setSelectedExpense(null);
    if (!vendorId) {
      setUnpaidExpenses([]);
      return;
    }

    const fetchUnpaidExpenses = async () => {
      const expensesQuery = query(
        collection(firestore, 'expenses'),
        where('vendorId', '==', vendorId),
        where('status', 'in', ['Unpaid', 'Partially Paid'])
      );
      const querySnapshot = await getDocs(expensesQuery);
      const expenses = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Expense));
      setUnpaidExpenses(expenses);
    };

    fetchUnpaidExpenses();
  }, [vendorId, firestore, form, isDataDirty]);

  // Set the selected expense details when an expense ID is chosen
  useEffect(() => {
    const expense = unpaidExpenses.find(e => e.id === expenseId);
    setSelectedExpense(expense || null);
    if (expense) {
      form.setValue('amountToPay', expense.price - expense.paidAmount);
    }
  }, [expenseId, unpaidExpenses, form]);

  // Fetch Outflow transactions for the log
  useEffect(() => {
    if (!isDataDirty) return;

    const fetchOutflows = async () => {
        setIsLoadingLog(true);
        try {
            const outflowsQuery = query(collectionGroup(firestore, 'outflowTransactions'));
            const [outflowSnap, projectsSnap, itemsSnap, expensesSnap] = await Promise.all([
                getDocs(outflowsQuery),
                getDocs(collection(firestore, 'projects')),
                getDocs(collection(firestore, 'expenseItems')),
                getDocs(collection(firestore, 'expenses')), // Fetch all expenses
            ]);
            
            const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data().projectName]));
            const expensesMap = new Map(expensesSnap.docs.map(d => {
                const data = d.data() as Expense;
                return [data.expenseId, { itemId: data.itemId, projectId: data.projectId, docId: d.id }];
            }));
            const itemsMap = new Map(itemsSnap.docs.map(d => [d.id, d.data().name]));

            const enriched = outflowSnap.docs.map(doc => {
                const data = { ...doc.data(), id: doc.id } as OutflowTransaction;
                const expenseDetails = data.expenseId ? expensesMap.get(data.expenseId) : undefined;
                const itemName = expenseDetails ? itemsMap.get(expenseDetails.itemId) : 'N/A';
                const projectName = expenseDetails ? projectsMap.get(expenseDetails.projectId) : (data.projectId ? projectsMap.get(data.projectId) : 'Office');

                return {
                    ...data,
                    projectName: projectName,
                    itemName: itemName,
                };
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setOutflowTransactions(enriched);
        } catch (error) {
            console.error("Error fetching outflow data:", error);
            toast({
                variant: 'destructive',
                title: 'Error Loading Payments',
                description: 'Could not fetch vendor payment data.',
            })
        }
        setIsLoadingLog(false);
        setIsDataDirty(false);
    };
    fetchOutflows();
  }, [firestore, isDataDirty, toast]);

  async function onSubmit(data: MakePaymentFormValues) {
    if (!selectedExpense) {
      toast({ variant: 'destructive', title: 'Error', description: 'No expense selected.' });
      return;
    }
    
    const newPaidAmount = selectedExpense.paidAmount + data.amountToPay;
    if (newPaidAmount > selectedExpense.price) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Payment cannot exceed the total expense price.' });
      return;
    }
    
    const newStatus = newPaidAmount >= selectedExpense.price ? 'Paid' : 'Partially Paid';
    
    try {
        const batch = writeBatch(firestore);

        // 1. Update the expense document
        const expenseRef = doc(firestore, 'expenses', selectedExpense.id);
        batch.update(expenseRef, {
            paidAmount: newPaidAmount,
            status: newStatus,
        });

        // 2. Create the outflow transaction
        const outflowRef = doc(collection(firestore, 'projects', selectedExpense.projectId, 'outflowTransactions'));
        batch.set(outflowRef, {
            id: outflowRef.id,
            projectId: selectedExpense.projectId,
            amount: data.amountToPay,
            date: new Date(data.paymentDate).toISOString(),
            expenseCategory: 'Material', // This could be enhanced to be dynamic
            supplierVendor: vendors?.find(v => v.id === data.vendorId)?.vendorName || 'N/A',
            expenseId: selectedExpense.expenseId,
            description: `Payment for ${selectedExpense.expenseId}`,
            paymentMethod: data.paymentMethod,
            reference: data.reference,
        });

        await batch.commit();

        toast({ title: 'Payment Successful', description: `Paid ${formatCurrency(data.amountToPay)} for expense ${selectedExpense.expenseId}` });
        form.reset({
            vendorId: data.vendorId,
            expenseId: '',
            amountToPay: 0,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'Cash',
            reference: '',
        });
        setSelectedExpense(null);
        setIsDataDirty(true);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error processing payment', description: error.message });
    }
  }

  const handleDeleteClick = (payment: EnrichedOutflow) => {
    setSelectedPayment(payment);
    setIsDeleteAlertOpen(true);
  };
  
  const confirmDeletePayment = async () => {
    if (!selectedPayment) return;

    // If the payment is not linked to a specific expense, just delete the outflow transaction
    if (!selectedPayment.expenseId || !selectedPayment.projectId) {
        if (!selectedPayment.projectId) {
             toast({ variant: 'destructive', title: 'Cannot Delete', description: 'This payment is not associated with a project.' });
             setIsDeleteAlertOpen(false);
             return;
        }
        const paymentRef = doc(firestore, 'projects', selectedPayment.projectId, 'outflowTransactions', selectedPayment.id);
        await deleteDoc(paymentRef);
        toast({ title: 'Payment Deleted', description: 'The standalone payment has been deleted.' });
        setIsDataDirty(true);
        setIsDeleteAlertOpen(false);
        setSelectedPayment(null);
        return;
    }

    // If it is linked, perform the transaction to reverse the payment
    try {
        await runTransaction(firestore, async (transaction) => {
            const expenseQuery = query(collection(firestore, 'expenses'), where('expenseId', '==', selectedPayment.expenseId), limit(1));
            const expenseSnap = await getDocs(expenseQuery);

            if (expenseSnap.empty) {
                throw new Error(`Expense with ID ${selectedPayment.expenseId} not found.`);
            }

            const expenseDoc = expenseSnap.docs[0];
            const expenseData = expenseDoc.data() as Expense;

            const newPaidAmount = expenseData.paidAmount - selectedPayment.amount;
            const newStatus = newPaidAmount <= 0 ? 'Unpaid' : 'Partially Paid';
            
            transaction.update(expenseDoc.ref, {
                paidAmount: newPaidAmount,
                status: newStatus,
            });

            if(expenseData.projectId) {
                 const paymentRef = doc(firestore, 'projects', expenseData.projectId, 'outflowTransactions', selectedPayment.id);
                 transaction.delete(paymentRef);
            }
        });

        toast({ title: 'Payment Deleted', description: 'The payment has been reversed and the expense status updated.' });
        setIsDataDirty(true);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Deleting Payment', description: error.message });
    } finally {
        setIsDeleteAlertOpen(false);
        setSelectedPayment(null);
    }
  }
  
  const handleViewClick = (payment: EnrichedOutflow) => {
    setSelectedPayment(payment);
    setIsViewDialogOpen(true);
  };
  
  const handleEditClick = (payment: EnrichedOutflow) => {
    setSelectedPayment(payment);
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;

  const dueAmount = selectedExpense ? selectedExpense.price - selectedExpense.paidAmount : 0;
  
  const filteredTransactions = useMemo(() => {
    return outflowTransactions.filter(t => {
        const searchTerm = searchQuery.toLowerCase();
        const searchMatch = !searchTerm || (
            (t.supplierVendor || '').toLowerCase().includes(searchTerm) ||
            (t.projectName || '').toLowerCase().includes(searchTerm) ||
            (t.expenseId || '').toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm)
        );

        const tDate = new Date(t.date);
        const fromDate = dateRange?.from;
        const toDate = dateRange?.to;
        const dateMatch = !dateRange || (
            (!fromDate || tDate >= fromDate) &&
            (!toDate || tDate <= toDate)
        );

        return searchMatch && dateMatch;
    });
  }, [outflowTransactions, searchQuery, dateRange]);

  const totalPages = Math.ceil(filteredTransactions.length / PAYMENTS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * PAYMENTS_PER_PAGE,
    currentPage * PAYMENTS_PER_PAGE
  );

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
        'Date': new Date(tx.date).toLocaleDateString(),
        'Vendor': tx.supplierVendor,
        'Project': tx.projectName,
        'Expense ID': tx.expenseId || 'N/A',
        'Amount': tx.amount,
        'Method': tx.paymentMethod,
        'Reference': tx.reference,
    }));
    exportToCsv(dataToExport, `vendor_payments_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Make Vendor Payment</CardTitle>
          <CardDescription>Record a cash outflow for an existing expense.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Expense Selection</h3>
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Vendor</FormLabel>
                        <Combobox
                          options={vendors?.map(v => ({ value: v.id, label: v.vendorName })) || []}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a vendor"
                          searchPlaceholder="Search vendors..."
                          emptyText="No vendors found."
                          disabled={vendorsLoading}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expenseId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Expense</FormLabel>
                        <Combobox
                          options={unpaidExpenses.map(e => ({ value: e.id, label: `${e.expenseId} - Due: ${formatCurrency(e.price - e.paidAmount)}` }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select an unpaid expense"
                          searchPlaceholder="Search expenses..."
                          emptyText="No unpaid expenses for this vendor."
                          disabled={!vendorId || unpaidExpenses.length === 0}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Payment Details</h3>
                     {selectedExpense && (
                         <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Expense</p>
                                <p className="font-bold">{formatCurrency(selectedExpense.price)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Amount Paid</p>
                                <p className="font-bold">{formatCurrency(selectedExpense.paidAmount)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-muted-foreground">Current Due</p>
                                <p className="font-bold text-lg text-red-600">{formatCurrency(dueAmount)}</p>
                            </div>
                         </div>
                     )}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="amountToPay"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount to Pay (৳)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="0" {...field} disabled={!selectedExpense} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} disabled={!selectedExpense} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Combobox
                          options={[
                            { value: 'Cash', label: 'Cash' },
                            { value: 'Cheque', label: 'Cheque' },
                            { value: 'Bank Transfer', label: 'Bank Transfer' },
                          ]}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a method"
                          disabled={!selectedExpense}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Reference / Note</FormLabel>
                    <FormControl>
                        <Input placeholder="Optional (e.g., Cheque No. or Purpose)" {...field} disabled={!selectedExpense} />
                    </FormControl>
                    </FormItem>
                )}
                />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={form.formState.isSubmitting || !selectedExpense}>
                  Record Payment
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <CardTitle>Vendor Payment Log</CardTitle>
                    <CardDescription>A record of all cash outflows to vendors.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search payments..."
                            className="pl-8 sm:w-full lg:w-[300px]"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                     <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            {isLoadingLog ? (
                <p>Loading payment log...</p>
            ) : paginatedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <Ban className="h-12 w-12 mb-2" />
                    <p className="text-lg font-semibold">No payments found.</p>
                </div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Expense ID</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="font-medium">{tx.supplierVendor}</TableCell>
                                    <TableCell>{tx.projectName}</TableCell>
                                    <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-mono">{tx.expenseId || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => handleViewClick(tx)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleEditClick(tx)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(tx)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <div className="flex items-center justify-end space-x-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                 </div>
                </>
            )}
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete this payment. If linked to an expense, the expense's paid amount will be updated. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={confirmDeletePayment}
                    className="bg-destructive hover:bg-destructive/90"
                >
                    Delete Payment
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       {selectedPayment && (
        <>
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Payment Details</DialogTitle>
                        <DialogDescription>Viewing details for a payment to {selectedPayment.supplierVendor}</DialogDescription>
                    </DialogHeader>
                    <OutflowDetails payment={selectedPayment} />
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Payment</DialogTitle>
                        <DialogDescription>Updating payment record</DialogDescription>
                    </DialogHeader>
                    <EditOutflowForm 
                        payment={selectedPayment}
                        setDialogOpen={setIsEditDialogOpen}
                        onUpdate={() => setIsDataDirty(true)}
                    />
                </DialogContent>
            </Dialog>
        </>
      )}

    </div>
  );
}

    