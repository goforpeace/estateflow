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
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Project, Customer, Sale, Flat, PaymentMode } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const addPaymentFormSchema = z.object({
  customerId: z.string().min(1, { message: 'Please select a customer.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  flatId: z.string().min(1, { message: 'Please select a flat.' }),
  amount: z.coerce.number().min(1, { message: 'Amount must be greater than 0.' }),
  paymentMethod: z.enum(['Cash', 'Cheque', 'Bank Transfer']),
  receiptId: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().min(1, { message: 'Payment date is required.' }),
});

type AddPaymentFormValues = z.infer<typeof addPaymentFormSchema>;

export default function AddPaymentPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [soldFlats, setSoldFlats] = useState<Flat[]>([]);
  const [projectsForCustomer, setProjectsForCustomer] = useState<Project[]>([]);
  const [flatsForProject, setFlatsForProject] = useState<Flat[]>([]);

  // Data fetching
  const customersQuery = useMemoFirebase(() => query(collection(firestore, 'customers')), [firestore]);
  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);

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

  useEffect(() => {
    async function fetchCustomerData() {
      if (customerId) {
        const salesQuery = query(collection(firestore, 'sales'), where('customerId', '==', customerId));
        const salesSnap = await getDocs(salesQuery);
        const sales = salesSnap.docs.map(doc => doc.data() as Sale);
        
        const projectIds = [...new Set(sales.map(s => s.projectId))];

        if (projectIds.length > 0) {
            const projectsQuery = query(collection(firestore, 'projects'), where('id', 'in', projectIds));
            const projectsSnap = await getDocs(projectsQuery);
            setProjectsForCustomer(projectsSnap.docs.map(doc => doc.data() as Project));
        } else {
            setProjectsForCustomer([]);
        }
        form.setValue('projectId', '');
        form.setValue('flatId', '');
      } else {
        setProjectsForCustomer([]);
      }
    }
    fetchCustomerData();
  }, [customerId, firestore, form]);

  useEffect(() => {
    async function fetchProjectData() {
        if (customerId && projectId) {
            const salesQuery = query(collection(firestore, 'sales'), where('customerId', '==', customerId), where('projectId', '==', projectId));
            const salesSnap = await getDocs(salesQuery);
            const flatIds = salesSnap.docs.map(doc => (doc.data() as Sale).flatId);
            
            if (flatIds.length > 0) {
                const flatsData: Flat[] = [];
                for(const flatId of flatIds) {
                    const flatQuery = query(collection(firestore, 'projects', projectId, 'flats'), where('id', '==', flatId));
                    const flatSnap = await getDocs(flatQuery);
                    flatSnap.forEach(doc => flatsData.push(doc.data() as Flat));
                }
                setFlatsForProject(flatsData);
            } else {
                setFlatsForProject([]);
            }
             form.setValue('flatId', '');
        } else {
            setFlatsForProject([]);
        }
    }
    fetchProjectData();
  }, [customerId, projectId, firestore, form]);


  async function onSubmit(data: AddPaymentFormValues) {
    try {
        const inflowCollection = collection(firestore, 'projects', data.projectId, 'inflowTransactions');
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
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error recording payment: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not record the payment. ' + error.message,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Payment</CardTitle>
        <CardDescription>Record a new cash inflow from a customer.</CardDescription>
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
                        defaultValue={field.value}
                        disabled={customersLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer) => (
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
                        defaultValue={field.value}
                        disabled={!customerId || projectsForCustomer.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectsForCustomer.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.projectName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Projects this customer has purchased in.</FormDescription>
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
                        defaultValue={field.value}
                        disabled={!projectId || flatsForProject.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a flat" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {flatsForProject.map((flat) => (
                            <SelectItem key={flat.id} value={flat.id}>
                              {flat.flatNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                       <FormDescription>Flats this customer owns in the selected project.</FormDescription>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
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
                        <Input placeholder="Optional (e.g., Cheque No.)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
