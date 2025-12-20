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
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { Project, Vendor, ExpenseItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PlusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const addExpenseFormSchema = z.object({
  vendorId: z.string().min(1, { message: 'Please select a vendor.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  itemId: z.string().min(1, { message: 'Please select an expense item.' }),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().min(1, { message: 'Price must be greater than 0.' }),
  date: z.string().min(1, { message: 'Expense date is required.' }),
  description: z.string().optional(),
});

type AddExpenseFormValues = z.infer<typeof addExpenseFormSchema>;

const addItemFormSchema = z.object({
  name: z.string().min(2, { message: 'Item name must be at least 2 characters.' }),
});
type AddItemFormValues = z.infer<typeof addItemFormSchema>;


// A small form component for the "Add Item" dialog
function AddItemForm({ setDialogOpen }: { setDialogOpen: (open: boolean) => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemFormSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(data: AddItemFormValues) {
    try {
      const itemsCollection = collection(firestore, 'expenseItems');
      addDocumentNonBlocking(itemsCollection, {
        id: doc(itemsCollection).id,
        ...data,
      });
      toast({ title: 'Item Added', description: `${data.name} has been added.` });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Item Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Steel Rods" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Adding...' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Form>
  );
}


export default function AddExpensePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);

  // Data fetching
  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'expenseItems')), [firestore]);
  const { data: expenseItems, isLoading: itemsLoading } = useCollection<ExpenseItem>(itemsQuery);

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseFormSchema),
    defaultValues: {
      vendorId: '',
      projectId: '',
      itemId: '',
      quantity: 1,
      price: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
    },
  });

  async function onSubmit(data: AddExpenseFormValues) {
    try {
      const batch = writeBatch(firestore);

      // 1. Create the main expense record
      const expenseRef = doc(collection(firestore, 'expenses'));
      batch.set(expenseRef, {
        ...data,
        id: expenseRef.id,
        date: new Date(data.date).toISOString(),
      });

      // 2. Create the corresponding outflow transaction for financial tracking
      const outflowRef = doc(collection(firestore, 'projects', data.projectId, 'outflowTransactions'));
      const vendorName = vendors?.find(v => v.id === data.vendorId)?.vendorName || 'N/A';
      const itemName = expenseItems?.find(i => i.id === data.itemId)?.name || 'N/A';
      
      batch.set(outflowRef, {
        id: outflowRef.id,
        projectId: data.projectId,
        amount: data.price,
        date: new Date(data.date).toISOString(),
        expenseCategory: 'Material', // Defaulting, could be enhanced
        supplierVendor: vendorName,
        description: `Expense for ${data.quantity} x ${itemName}. ${data.description || ''}`.trim(),
      });
      
      await batch.commit();

      toast({
        title: 'Expense Recorded',
        description: `An expense of ${data.price} has been successfully logged.`,
      });
      form.reset();
    } catch (error: any) {
      console.error('Error recording expense: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not record the expense. ' + error.message,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Expense</CardTitle>
        <CardDescription>Record a new project expense and cash outflow.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Details</h3>
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
                  name="projectId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Project</FormLabel>
                      <Combobox
                        options={projects?.map(p => ({ value: p.id, label: p.projectName })) || []}
                        value={field.value}
                        onChange={field.onChange}
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
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Itemization</h3>
                <FormItem className="flex flex-col">
                  <FormLabel>Item</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name="itemId"
                      render={({ field }) => (
                        <div className="flex-grow">
                          <Combobox
                            options={expenseItems?.map(i => ({ value: i.id, label: i.name })) || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select an item"
                            searchPlaceholder="Search items..."
                            emptyText="No items found."
                            disabled={itemsLoading}
                          />
                        </div>
                      )}
                    />
                    <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add New Expense Item</DialogTitle>
                        </DialogHeader>
                        <AddItemForm setDialogOpen={setIsAddItemDialogOpen} />
                      </DialogContent>
                    </Dialog>
                  </div>
                   <FormMessage>{form.formState.errors.itemId?.message}</FormMessage>
                </FormItem>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Price (৳)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <Separator />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any extra details about the expense..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Recording...' : 'Record Expense'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    