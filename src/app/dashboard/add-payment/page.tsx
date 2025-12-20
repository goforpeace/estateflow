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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
} from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  collectionGroup,
  limit,
  getDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type {
  Project,
  Customer,
  Sale,
  Flat,
  InflowTransaction,
  Counter,
} from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Ban, Printer, MoreHorizontal, Pencil, Trash2, Eye, FileDown, Search, Download } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Receipt } from '@/components/dashboard/receipt';
import { EditPaymentForm } from '@/components/dashboard/payments/edit-payment-form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { exportToCsv } from '@/lib/csv';


const addPaymentFormSchema = z.object({
  customerId: z.string().min(1, { message: 'Please select a customer.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  flatId: z.string().min(1, { message: 'Please select a flat.' }),
  amount: z.coerce
    .number()
    .min(1, { message: 'Amount must be greater than 0.' }),
  paymentMethod: z.enum(['Cash', 'Cheque', 'Bank Transfer']),
  paymentPurpose: z.enum(['Booking Money', 'Installment', 'Other']),
  otherPurpose: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().min(1, { message: 'Payment date is required.' }),
}).refine(data => {
    if (data.paymentPurpose === 'Other') {
        return !!data.otherPurpose && data.otherPurpose.length > 0;
    }
    return true;
}, {
    message: 'Please specify the purpose if "Other" is selected.',
    path: ['otherPurpose'],
});


type AddPaymentFormValues = z.infer<typeof addPaymentFormSchema>;

export type EnrichedTransaction = InflowTransaction & {
  customerName: string;
  projectName: string;
  flatNumber: string;
};

export default function AddPaymentPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [projectsForCustomer, setProjectsForCustomer] = useState<Project[]>([]);
  const [flatsForProject, setFlatsForProject] = useState<Flat[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<EnrichedTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isLogLoading, setIsLogLoading] = useState(true);
  const [lastPayment, setLastPayment] = useState<EnrichedTransaction | null>(null);
  const [editingPayment, setEditingPayment] = useState<InflowTransaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<{payment: EnrichedTransaction, customer: Customer, project: Project} | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);


  // Data fetching for form dropdowns
  const customersQuery = useMemoFirebase(
    () => query(collection(firestore, 'customers')),
    [firestore]
  );
  const { data: customers, isLoading: customersLoading } =
    useCollection<Customer>(customersQuery);

  const form = useForm<AddPaymentFormValues>({
    resolver: zodResolver(addPaymentFormSchema),
    defaultValues: {
      customerId: '',
      projectId: '',
      flatId: '',
      amount: 0,
      paymentMethod: 'Cash',
      paymentPurpose: 'Installment',
      otherPurpose: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const customerId = form.watch('customerId');
  const projectId = form.watch('projectId');
  const paymentPurpose = form.watch('paymentPurpose');

  // Fetch recent transactions for the log
  const fetchRecentTransactions = async () => {
    setIsLogLoading(true);
    try {
      // 1. Fetch all projects and customers to create lookup maps
      const projectsSnap = await getDocs(collection(firestore, 'projects'));
      const customersSnap = await getDocs(collection(firestore, 'customers'));
      const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data() as Project]));
      const customersMap = new Map(customersSnap.docs.map(d => [d.id, d.data() as Customer]));
      
      // Fetch all flats from all projects
      const allFlatsMap = new Map<string, Flat>();
        for (const project of projectsMap.values()) {
            const flatsQuery = query(collection(firestore, `projects/${project.id}/flats`));
            const flatsSnap = await getDocs(flatsQuery);
            flatsSnap.forEach(doc => {
                allFlatsMap.set(doc.id, doc.data() as Flat);
            });
        }

      // 2. Fetch last 5 inflow transactions
      const inflowsQuery = query(
        collectionGroup(firestore, 'inflowTransactions'),
        limit(10) // Fetch more to allow for filtering
      );
      const inflowSnap = await getDocs(inflowsQuery);
      const inflows = inflowSnap.docs.map(
        doc => ({ ...doc.data(), id: doc.id } as InflowTransaction)
      );

      // 3. Enrich transactions with names synchronously
      const enriched: EnrichedTransaction[] = inflows.map(tx => {
         const flatData = allFlatsMap.get(tx.flatId);
         return {
            ...tx,
            customerName: customersMap.get(tx.customerId)?.fullName || 'N/A',
            projectName: projectsMap.get(tx.projectId)?.projectName || 'N/A',
            flatNumber: flatData?.flatNumber || 'N/A',
         };
      });

      setRecentTransactions(enriched);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      toast({ variant: 'destructive', title: 'Could not load recent payments.' });
    }
    setIsLogLoading(false);
  };

  // Initial fetch for recent transactions
  useEffect(() => {
    if (firestore) {
      fetchRecentTransactions();
    }
  }, [firestore, toast]);


  useEffect(() => {
    async function fetchCustomerData() {
      // Clear dependent fields when customer changes
      setProjectsForCustomer([]);
      setFlatsForProject([]);
      form.setValue('projectId', '');
      form.setValue('flatId', '');

      if (customerId && firestore) {
        // Find all sales for the selected customer
        const salesQuery = query(
          collection(firestore, 'sales'),
          where('customerId', '==', customerId)
        );
        const salesSnap = await getDocs(salesQuery);
        const sales = salesSnap.docs.map(doc => doc.data() as Sale);

        // Get unique project IDs from the sales
        const projectIds = [...new Set(sales.map(s => s.projectId))];

        if (projectIds.length > 0) {
          const projectsData: Project[] = [];
          // Fetch project details for each unique project ID
          for (const pId of projectIds) {
            const projectDoc = await getDocs(
              query(collection(firestore, 'projects'), where('id', '==', pId))
            );
            projectDoc.forEach(doc => projectsData.push(doc.data() as Project));
          }
          setProjectsForCustomer(projectsData);
        }
      }
    }
    fetchCustomerData();
  }, [customerId, firestore, form]);

  useEffect(() => {
    async function fetchProjectData() {
      // Clear flat field when project changes
      setFlatsForProject([]);
      form.setValue('flatId', '');

      if (customerId && projectId && firestore) {
        // Find sales for the specific customer and project
        const salesQuery = query(
          collection(firestore, 'sales'),
          where('customerId', '==', customerId),
          where('projectId', '==', projectId)
        );
        const salesSnap = await getDocs(salesQuery);
        const flatIds = salesSnap.docs.map(doc => (doc.data() as Sale).flatId);

        if (flatIds.length > 0) {
          const flatsData: Flat[] = [];
          // Fetch flat details for each flat ID found
          for (const flatId of flatIds) {
            const flatQuery = query(
              collection(firestore, 'projects', projectId, 'flats'),
              where('id', '==', flatId)
            );
            const flatSnap = await getDocs(flatQuery);
            flatSnap.forEach(doc => flatsData.push(doc.data() as Flat));
          }
          setFlatsForProject(flatsData);

          // If there's only one flat, auto-select it
          if (flatsData.length === 1) {
            form.setValue('flatId', flatsData[0].id);
          }
        }
      }
    }
    fetchProjectData();
  }, [customerId, projectId, firestore, form]);
  
  const getNextReceiptId = async (): Promise<string> => {
    const counterRef = doc(firestore, 'counters', 'receipt');
    try {
        const newCurrent = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                // Initialize counter if it doesn't exist
                transaction.set(counterRef, { current: 1200 });
                return 1200;
            }
            const newCurrent = (counterDoc.data() as Counter).current + 1;
            transaction.update(counterRef, { current: newCurrent });
            return newCurrent;
        });
        return newCurrent.toString();
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw new Error("Could not generate receipt ID.");
    }
  };


  async function onSubmit(data: AddPaymentFormValues) {
    try {
        const receiptId = await getNextReceiptId();
        
        const inflowCollection = collection(
            firestore,
            'projects',
            data.projectId,
            'inflowTransactions'
        );
        const newInflowRef = doc(inflowCollection);

        const newPayment: InflowTransaction = {
            id: newInflowRef.id,
            receiptId,
            projectId: data.projectId,
            flatId: data.flatId,
            customerId: data.customerId,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            paymentType: data.paymentPurpose === 'Booking Money' ? 'Booking' : 'Installment',
            paymentPurpose: data.paymentPurpose,
            otherPurpose: data.otherPurpose,
            reference: data.reference,
            date: new Date(data.date).toISOString(),
        };

        await runTransaction(firestore, async (transaction) => {
            transaction.set(newInflowRef, newPayment);
        });
        
        const customer = customers?.find(c => c.id === data.customerId);
        const project = projectsForCustomer?.find(p => p.id === data.projectId);
        const flat = flatsForProject?.find(f => f.id === data.flatId);

        const enrichedPayment = {
            ...newPayment,
            customerName: customer?.fullName || 'N/A',
            projectName: project?.projectName || 'N/A',
            flatNumber: flat?.flatNumber || 'N/A',
        };

        setLastPayment(enrichedPayment);
        
        if (customer && project) {
            setViewingPayment({ payment: enrichedPayment, customer, project });
            setIsViewDialogOpen(true);
        }

        toast({
            title: 'Payment Recorded',
            description: `Payment of ৳${data.amount} has been successfully recorded with Receipt ID: ${receiptId}.`,
        });
        
        form.reset({
            ...form.getValues(),
            amount: 0,
            reference: '',
            otherPurpose: '',
            date: new Date().toISOString().split('T')[0],
        });
        
        // Refresh the log
        fetchRecentTransactions();

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: error.message || 'Could not record the payment.',
        });
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!recentTransactions) return [];
    return recentTransactions.filter(tx => {
        // Search term filter
        const searchTerm = searchQuery.toLowerCase();
        const searchMatch = !searchTerm || (
            tx.customerName.toLowerCase().includes(searchTerm) ||
            tx.projectName.toLowerCase().includes(searchTerm) ||
            tx.flatNumber.toLowerCase().includes(searchTerm) ||
            (tx.paymentMethod || '').toLowerCase().includes(searchTerm) ||
            tx.amount.toString().includes(searchTerm) ||
            new Date(tx.date).toLocaleDateString().includes(searchTerm)
        );

        // Date range filter
        const txDate = new Date(tx.date);
        const fromDate = dateRange?.from;
        const toDate = dateRange?.to;
        const dateMatch = !dateRange || (
            (!fromDate || txDate >= fromDate) &&
            (!toDate || txDate <= toDate)
        );

        return searchMatch && dateMatch;
    });
  }, [recentTransactions, searchQuery, dateRange]);

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
        'Receipt ID': tx.receiptId,
        'Date': new Date(tx.date).toLocaleDateString(),
        'Customer': tx.customerName,
        'Project': tx.projectName,
        'Flat': tx.flatNumber,
        'Amount': tx.amount,
        'Method': tx.paymentMethod,
        'Purpose': tx.paymentPurpose === 'Other' ? tx.otherPurpose : tx.paymentPurpose,
        'Reference': tx.reference,
    }));
    exportToCsv(dataToExport, `recent_payments_${new Date().toISOString().split('T')[0]}.csv`);
  };


  const handleEditClick = (payment: InflowTransaction) => {
    setEditingPayment(payment);
    setIsEditDialogOpen(true);
  };

  const handleDeletePayment = async (payment: InflowTransaction) => {
    const paymentRef = doc(firestore, 'projects', payment.projectId, 'inflowTransactions', payment.id);
    deleteDocumentNonBlocking(paymentRef);
    toast({
        title: "Payment Deleted",
        description: "The payment has been successfully deleted.",
    });
    fetchRecentTransactions(); // Refresh the list
  };

    const handleViewClick = async (payment: EnrichedTransaction) => {
        const customerSnap = await getDoc(doc(firestore, 'customers', payment.customerId));
        const projectSnap = await getDoc(doc(firestore, 'projects', payment.projectId));

        if (!customerSnap.exists() || !projectSnap.exists()) {
             toast({
                variant: 'destructive',
                title: 'Missing Data',
                description: 'Cannot display receipt. Customer or Project data is missing.',
            });
            return;
        }

        setViewingPayment({
            payment,
            customer: customerSnap.data() as Customer,
            project: projectSnap.data() as Project,
        });
        setIsViewDialogOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Payment</CardTitle>
          <CardDescription>
            Record a new cash inflow from a customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-primary">Payment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Customer</FormLabel>
                        <Combobox
                          options={customers?.map(c => ({ value: c.id, label: c.fullName })) || []}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a customer"
                          searchPlaceholder="Search customers..."
                          emptyText="No customer found."
                          disabled={customersLoading}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Project</FormLabel>
                        <Combobox
                          options={projectsForCustomer.map(p => ({ value: p.id, label: p.projectName }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a project"
                          searchPlaceholder="Search projects..."
                          emptyText="No projects for this customer."
                          disabled={!customerId || projectsForCustomer.length === 0}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="flatId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Flat</FormLabel>
                        <Combobox
                          options={flatsForProject.map(f => ({ value: f.id, label: f.flatNumber }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a flat"
                          searchPlaceholder="Search flats..."
                          emptyText="No flats found."
                          disabled={!projectId || flatsForProject.length === 0}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary">Purpose of Payment</h3>
                    <FormField
                        control={form.control}
                        name="paymentPurpose"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Booking Money" />
                                  </FormControl>
                                  <FormLabel className="font-normal">Booking Money</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Installment" />
                                  </FormControl>
                                  <FormLabel className="font-normal">Installment</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Other" />
                                  </FormControl>
                                  <FormLabel className="font-normal">Other</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {paymentPurpose === 'Other' && (
                          <FormField
                              control={form.control}
                              name="otherPurpose"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Please Specify</FormLabel>
                                      <FormControl>
                                          <Input placeholder="e.g., Parking Fee" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                      )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-primary">Amount & Method</h3>
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (৳)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="50000" {...field} />
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
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                              <SelectItem value="Bank Transfer">
                                Bank Transfer
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-primary">Additional Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Optional (e.g., Cheque No.)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? 'Recording...'
                    : 'Record Payment'}
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
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>
                  A log of the most recent cash inflows.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search payments..."
                            className="pl-8 sm:w-[200px] lg:w-[300px]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLogLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading recent payments...</p>
            </div>
          )}
          {!isLogLoading && !filteredTransactions?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No payments found.</p>
              <p className="text-sm">
                Once you add a payment, it will appear here. {searchQuery && 'Try a different search.'}
              </p>
            </div>
          )}
          {!isLogLoading && filteredTransactions && filteredTransactions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project / Flat</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.customerName}</TableCell>
                    <TableCell>
                        <div className="font-medium">{tx.projectName}</div>
                        <div className="text-sm text-muted-foreground">{tx.flatNumber}</div>
                    </TableCell>
                    <TableCell>
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tx.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                     <TableCell className="text-right">
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                               <DropdownMenuItem onClick={() => handleViewClick(tx)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Receipt
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(tx)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this payment record.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePayment(tx)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        {editingPayment && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Payment</DialogTitle>
                        <CardDescription>Update the details for this payment record.</CardDescription>
                    </DialogHeader>
                    <EditPaymentForm 
                        payment={editingPayment} 
                        setDialogOpen={setIsEditDialogOpen}
                        onUpdate={fetchRecentTransactions}
                    />
                </DialogContent>
            </Dialog>
        )}

        {viewingPayment && (
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-4xl p-0">
                    <ScrollArea className="max-h-[90vh]">
                        <Receipt 
                            payment={viewingPayment.payment} 
                            customer={viewingPayment.customer} 
                            project={viewingPayment.project}
                        />
                    </ScrollArea>
                     <DialogFooter className="p-4 border-t bg-muted print:hidden">
                        <Button type="button" variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                        <Button type="button" onClick={handlePrint}>
                           <FileDown className="mr-2 h-4 w-4" /> Save as PDF
                        </Button>
                        <Button type="button" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}
