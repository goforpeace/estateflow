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
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  collectionGroup,
  orderBy,
  limit,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type {
  Project,
  Customer,
  Sale,
  Flat,
  InflowTransaction,
} from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
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
import { Ban } from 'lucide-react';

const addPaymentFormSchema = z.object({
  customerId: z.string().min(1, { message: 'Please select a customer.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  flatId: z.string().min(1, { message: 'Please select a flat.' }),
  amount: z.coerce
    .number()
    .min(1, { message: 'Amount must be greater than 0.' }),
  paymentMethod: z.enum(['Cash', 'Cheque', 'Bank Transfer']),
  receiptId: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().min(1, { message: 'Payment date is required.' }),
});

type AddPaymentFormValues = z.infer<typeof addPaymentFormSchema>;

type EnrichedTransaction = InflowTransaction & {
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
  const [isLogLoading, setIsLogLoading] = useState(true);

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
      receiptId: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const customerId = form.watch('customerId');
  const projectId = form.watch('projectId');

  // Fetch recent transactions for the log
  const fetchRecentTransactions = async () => {
    setIsLogLoading(true);
    try {
      // 1. Fetch all projects and customers to create lookup maps
      const projectsSnap = await getDocs(collection(firestore, 'projects'));
      const customersSnap = await getDocs(collection(firestore, 'customers'));
      const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data() as Project]));
      const customersMap = new Map(customersSnap.docs.map(d => [d.id, d.data() as Customer]));
      
      // 2. Fetch last 5 inflow transactions
      const inflowsQuery = query(
        collectionGroup(firestore, 'inflowTransactions'),
        orderBy('date', 'desc'),
        limit(5)
      );
      const inflowSnap = await getDocs(inflowsQuery);
      const inflows = inflowSnap.docs.map(
        doc => ({ ...doc.data(), id: doc.id } as InflowTransaction)
      );

      // 3. Enrich transactions with names
      const enriched: EnrichedTransaction[] = [];
      for (const tx of inflows) {
         const flatSnap = await getDocs(query(collection(firestore, `projects/${tx.projectId}/flats`), where('id', '==', tx.flatId)));
         const flatData = flatSnap.docs[0]?.data() as Flat;

         enriched.push({
            ...tx,
            customerName: customersMap.get(tx.customerId)?.fullName || 'N/A',
            projectName: projectsMap.get(tx.projectId)?.projectName || 'N/A',
            flatNumber: flatData?.flatNumber || 'N/A',
         });
      }

      setRecentTransactions(enriched);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      toast({ variant: 'destructive', title: 'Could not load recent payments.' });
    }
    setIsLogLoading(false);
  };

  // Initial fetch for recent transactions
  useEffect(() => {
    fetchRecentTransactions();
  }, [firestore]);


  useEffect(() => {
    async function fetchCustomerData() {
      // Clear dependent fields when customer changes
      setProjectsForCustomer([]);
      setFlatsForProject([]);
      form.setValue('projectId', '');
      form.setValue('flatId', '');

      if (customerId) {
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

      if (customerId && projectId) {
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

  function onSubmit(data: AddPaymentFormValues) {
    const inflowCollection = collection(
      firestore,
      'projects',
      data.projectId,
      'inflowTransactions'
    );
    const newInflowRef = doc(inflowCollection);

    const newPayment = {
      id: newInflowRef.id,
      ...data,
      date: new Date(data.date).toISOString(),
      paymentType: 'Installment', // Assuming payments added here are installments
    };

    addDocumentNonBlocking(inflowCollection, newPayment);

    toast({
      title: 'Payment Recorded',
      description: `Payment of ৳${data.amount} has been successfully recorded.`,
    });
    
    form.reset({
        ...form.getValues(),
        amount: 0,
        receiptId: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
    });
    
    // Refresh the log
    fetchRecentTransactions();
  }

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
                <h3 className="text-lg font-medium">Payment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={customersLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers?.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!customerId || projectsForCustomer.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projectsForCustomer.map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.projectName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Projects this customer has purchased in.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="flatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flat</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!projectId || flatsForProject.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a flat" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {flatsForProject.map(flat => (
                              <SelectItem key={flat.id} value={flat.id}>
                                {flat.flatNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Flats this customer owns in the selected project.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Amount & Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <h3 className="text-lg font-medium">Additional Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    name="receiptId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
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

              <div className="flex justify-end pt-4">
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
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>
            A log of the 5 most recent cash inflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading recent payments...</p>
            </div>
          )}
          {!isLogLoading && !recentTransactions?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No payments found.</p>
              <p className="text-sm">
                Once you add a payment, it will appear here.
              </p>
            </div>
          )}
          {!isLogLoading && recentTransactions && recentTransactions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project / Flat</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map(tx => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
