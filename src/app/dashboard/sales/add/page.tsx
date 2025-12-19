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
} from '@/firebase';
import { collection, doc, writeBatch, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Project, Flat, Customer } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const addSaleFormSchema = z.object({
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  flatId: z.string().min(1, { message: 'Please select a flat.' }),
  customerId: z.string().min(1, { message: 'Please select a customer.' }),
  totalPrice: z.coerce.number().min(1, { message: 'Total price is required.' }),
  perSftPrice: z.coerce.number().optional(),
  parkingCharge: z.coerce.number().optional(),
  utilityCharge: z.coerce.number().optional(),
  downpayment: z.coerce.number().optional(),
  monthlyInstallment: z.coerce.number().optional(),
  saleDate: z.string().min(1, { message: 'Sale date is required.' }),
  note: z.string().optional(),
  deedLink: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
});

type AddSaleFormValues = z.infer<typeof addSaleFormSchema>;

export default function AddSalePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Data fetching
  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const customersQuery = useMemoFirebase(() => query(collection(firestore, 'customers')), [firestore]);
  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);

  const availableFlatsQuery = useMemoFirebase(() =>
    selectedProjectId
      ? query(
          collection(firestore, 'projects', selectedProjectId, 'flats'),
          where('status', '==', 'Available')
        )
      : null
  , [firestore, selectedProjectId]);
  const { data: availableFlats, isLoading: flatsLoading } = useCollection<Flat>(availableFlatsQuery);

  const form = useForm<AddSaleFormValues>({
    resolver: zodResolver(addSaleFormSchema),
    defaultValues: {
      projectId: '',
      flatId: '',
      customerId: '',
      totalPrice: 0,
      perSftPrice: 0,
      parkingCharge: 0,
      utilityCharge: 0,
      downpayment: 0,
      monthlyInstallment: 0,
      saleDate: new Date().toISOString().split('T')[0],
      note: '',
      deedLink: '',
    },
  });

  async function onSubmit(data: AddSaleFormValues) {
    try {
        const batch = writeBatch(firestore);

        // 1. Create new sale document
        const saleRef = doc(collection(firestore, 'sales'));
        batch.set(saleRef, {
            id: saleRef.id,
            ...data,
            saleDate: new Date(data.saleDate).toISOString(),
        });

        // 2. Update flat status to 'Sold'
        const flatRef = doc(firestore, 'projects', data.projectId, 'flats', data.flatId);
        batch.update(flatRef, { status: 'Sold' });
        
        // 3. Create an initial inflow transaction for the downpayment if provided
        if (data.downpayment && data.downpayment > 0) {
            const inflowRef = doc(collection(firestore, 'projects', data.projectId, 'inflowTransactions'));
            batch.set(inflowRef, {
                id: inflowRef.id,
                projectId: data.projectId,
                flatId: data.flatId,
                customerId: data.customerId,
                paymentType: 'Booking',
                date: new Date(data.saleDate).toISOString(),
                amount: data.downpayment,
            });
        }
        
        await batch.commit();

      toast({
        title: 'Sale Recorded',
        description: `The sale has been successfully recorded.`,
      });
      router.push('/dashboard/sales');
    } catch (error: any) {
      console.error('Error recording sale: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not record the sale. ' + error.message,
      });
    }
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Add New Sale</CardTitle>
            <CardDescription>Record a new property sale transaction.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Property Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Project</FormLabel>
                            <Select
                                onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedProjectId(value);
                                form.setValue('flatId', ''); // Reset flat when project changes
                                }}
                                defaultValue={field.value}
                                disabled={projectsLoading}
                            >
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a project" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {projects?.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                    {project.projectName}
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
                        name="flatId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Flat Number</FormLabel>
                            <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                                disabled={!selectedProjectId || flatsLoading}
                            >
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an available flat" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {availableFlats?.map((flat) => (
                                    <SelectItem key={flat.id} value={flat.id}>
                                    {flat.flatNumber} ({flat.flatSize} sft)
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                Only flats with status 'Available' are shown.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                     <h3 className="text-lg font-medium">Customer Details</h3>
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
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Financials</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField
                            control={form.control}
                            name="totalPrice"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Total Price (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="5000000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="perSftPrice"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Price per SFT (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="5000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="parkingCharge"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Parking Charge (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="200000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="utilityCharge"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Utility Charge (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="150000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="downpayment"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Downpayment (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="1000000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="monthlyInstallment"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Monthly Installment (৳)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="50000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Separator />
                
                <div className="space-y-4">
                     <h3 className="text-lg font-medium">Sale Details</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="saleDate"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sale Date</FormLabel>
                                <FormControl>
                                <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="deedLink"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Deed Link</FormLabel>
                                <FormControl>
                                <Input placeholder="https://example.com/deed.pdf" {...field} />
                                </FormControl>
                                 <FormDescription>
                                    Link to the deed PDF (e.g., on Cloudinary).
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                     </div>
                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Note</FormLabel>
                            <FormControl>
                            <Textarea placeholder="Any additional notes about the sale..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={form.formState.isSubmitting || projectsLoading || customersLoading || flatsLoading}>
                        {form.formState.isSubmitting ? 'Recording Sale...' : 'Record Sale'}
                    </Button>
                </div>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}