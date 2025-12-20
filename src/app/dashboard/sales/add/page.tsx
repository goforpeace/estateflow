
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const addSaleFormSchema = z.object({
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  flatId: z.string().min(1, { message: 'Please select a flat.' }),
  customerId: z.string().min(1, { message: 'Please select a customer.' }),
  totalPrice: z.coerce.number().min(1, { message: 'Base price is required.' }),
  perSftPrice: z.coerce.number().optional(),
  parkingCharge: z.coerce.number().optional(),
  utilityCharge: z.coerce.number().optional(),
  downpayment: z.coerce.number().optional(),
  monthlyInstallment: z.coerce.number().optional(),
  saleDate: z.string().min(1, { message: 'Sale date is required.' }),
  note: z.string().optional(),
  deedLink: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  extraCosts: z.array(z.object({
    purpose: z.string().min(1, { message: 'Purpose is required.' }),
    amount: z.coerce.number().min(1, { message: 'Amount must be > 0.' }),
  })).optional(),
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
      extraCosts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "extraCosts",
  });
  
  const watchBasePrice = form.watch('totalPrice');
  const watchExtraCosts = form.watch('extraCosts');
  const watchDownpayment = form.watch('downpayment');

  const calculatedTotalPrice = (Number(watchBasePrice) || 0) + 
    (watchExtraCosts?.reduce((acc, cost) => acc + (Number(cost.amount) || 0), 0) || 0);

  const dueAmount = calculatedTotalPrice;

  async function onSubmit(data: AddSaleFormValues) {
    try {
        const batch = writeBatch(firestore);
        
        const finalTotalPrice = calculatedTotalPrice;

        // 1. Create new sale document
        const saleRef = doc(collection(firestore, 'sales'));
        batch.set(saleRef, {
            ...data,
            id: saleRef.id,
            totalPrice: finalTotalPrice,
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
                paymentMethod: 'Cash', // Default or consider adding to form
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
  
  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;


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
                            <FormItem className="flex flex-col">
                            <FormLabel>Project</FormLabel>
                             <Combobox
                                options={projects?.map((project) => ({ value: project.id, label: project.projectName })) || []}
                                value={field.value}
                                onChange={(value) => {
                                    field.onChange(value);
                                    setSelectedProjectId(value);
                                    form.setValue('flatId', ''); // Reset flat when project changes
                                }}
                                placeholder="Select a project"
                                searchPlaceholder="Search projects..."
                                emptyText="No projects found."
                                disabled={projectsLoading}
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
                            <FormLabel>Flat Number</FormLabel>
                             <Combobox
                                options={availableFlats?.map((flat) => ({ value: flat.id, label: `${flat.flatNumber} (${flat.flatSize} sft)` })) || []}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select an available flat"
                                searchPlaceholder="Search flats..."
                                emptyText="No available flats found."
                                disabled={!selectedProjectId || flatsLoading}
                            />
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
                        <FormItem className="flex flex-col">
                            <FormLabel>Customer</FormLabel>
                             <Combobox
                                options={customers?.map((customer) => ({ value: customer.id, label: customer.fullName })) || []}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select a customer"
                                searchPlaceholder="Search customers..."
                                emptyText="No customers found."
                                disabled={customersLoading}
                            />
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
                                <FormLabel>Base Price (৳)</FormLabel>
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
                </div>

                <Separator />
                
                 <div className="space-y-4">
                    <h3 className="text-lg font-medium">Extra Costs</h3>
                    <div className="space-y-2">
                        {fields.map((field, index) => (
                           <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 p-3 border rounded-lg">
                               <FormField
                                   control={form.control}
                                   name={`extraCosts.${index}.purpose`}
                                   render={({ field }) => (
                                       <FormItem>
                                            <FormLabel className={cn(index !== 0 && "sr-only")}>Purpose</FormLabel>
                                            <FormControl>
                                               <Input {...field} placeholder="e.g., Interior Design" />
                                            </FormControl>
                                            <FormMessage />
                                       </FormItem>
                                   )}
                               />
                               <FormField
                                   control={form.control}
                                   name={`extraCosts.${index}.amount`}
                                   render={({ field }) => (
                                       <FormItem>
                                            <FormLabel className={cn(index !== 0 && "sr-only")}>Amount</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} placeholder="50000" />
                                            </FormControl>
                                            <FormMessage />
                                       </FormItem>
                                   )}
                               />
                               <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                               </Button>
                           </div>
                        ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" onClick={() => append({ purpose: '', amount: 0 })}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Extra Cost
                     </Button>
                </div>
                
                 <Separator />

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Payment Plan</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
                        <div className="p-4 bg-muted rounded-lg">
                            <FormLabel>Total Price</FormLabel>
                            <p className="text-xl font-bold">{formatCurrency(calculatedTotalPrice)}</p>
                        </div>
                         <div className="p-4 bg-muted rounded-lg">
                            <FormLabel>Due Amount</FormLabel>
                            <p className="text-xl font-bold text-destructive">{formatCurrency(dueAmount)}</p>
                        </div>
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
                                    Link to the deed PDF (e.g., on Cloud Storage).
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

    
