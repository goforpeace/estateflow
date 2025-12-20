
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Project, Vendor, ExpenseItem, Expense } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EnrichedExpense } from '@/app/dashboard/expense/page';

const editExpenseFormSchema = z.object({
  vendorId: z.string().min(1, { message: 'Please select a vendor.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  itemId: z.string().min(1, { message: 'Please select an expense item.' }),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().min(1, { message: 'Price must be greater than 0.' }),
  date: z.string().min(1, { message: 'Expense date is required.' }),
  description: z.string().optional(),
});

type EditExpenseFormValues = z.infer<typeof editExpenseFormSchema>;

interface EditExpenseFormProps {
  expense: EnrichedExpense;
  setDialogOpen: (open: boolean) => void;
  onUpdate: () => void;
}

export function EditExpenseForm({ expense, setDialogOpen, onUpdate }: EditExpenseFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'expenseItems')), [firestore]);
  const { data: expenseItems, isLoading: itemsLoading } = useCollection<ExpenseItem>(itemsQuery);

  const form = useForm<EditExpenseFormValues>({
    resolver: zodResolver(editExpenseFormSchema),
    defaultValues: {
      ...expense,
      date: new Date(expense.date).toISOString().split('T')[0],
    },
  });

  async function onSubmit(data: EditExpenseFormValues) {
    try {
      const expenseRef = doc(firestore, 'expenses', expense.id);
      
      const updatedData = {
        ...data,
        date: new Date(data.date).toISOString(),
      };

      updateDocumentNonBlocking(expenseRef, updatedData);

      toast({
        title: 'Expense Updated',
        description: `Expense ${expense.expenseId} has been successfully updated.`,
      });
      onUpdate();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating expense: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not update the expense. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>
             <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Item</FormLabel>
                     <Combobox
                        options={expenseItems?.map(i => ({ value: i.id, label: i.name })) || []}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select an item"
                        searchPlaceholder="Search items..."
                        emptyText="No items found."
                        disabled={itemsLoading}
                    />
                    <FormMessage />
                  </FormItem>
                )}
                />
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
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Add any extra details..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
