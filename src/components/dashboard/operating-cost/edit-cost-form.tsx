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
import type { OperatingCost, OperatingCostItem } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import type { EnrichedOperatingCost } from '@/app/dashboard/operating-cost/page';
import { ScrollArea } from '@/components/ui/scroll-area';


const editCostFormSchema = z.object({
  date: z.string().min(1, { message: 'Expense date is required.' }),
  itemId: z.string().min(1, { message: 'Please select an item.' }),
  description: z.string().optional(),
  reference: z.string().optional(),
  amount: z.coerce.number().min(1, { message: 'Amount must be greater than 0.' }),
});

type EditCostFormValues = z.infer<typeof editCostFormSchema>;

interface EditOperatingCostFormProps {
  cost: EnrichedOperatingCost;
  setDialogOpen: (open: boolean) => void;
}

export function EditOperatingCostForm({ cost, setDialogOpen }: EditOperatingCostFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'operatingCostItems')), [firestore]);
  const { data: costItems, isLoading: itemsLoading } = useCollection<OperatingCostItem>(itemsQuery);

  const form = useForm<EditCostFormValues>({
    resolver: zodResolver(editCostFormSchema),
    defaultValues: {
      ...cost,
      date: new Date(cost.date).toISOString().split('T')[0],
    },
  });

  async function onSubmit(data: EditCostFormValues) {
    try {
      const costRef = doc(firestore, 'operatingCosts', cost.id);
      
      const updatedData = {
        ...data,
        date: new Date(data.date).toISOString(),
      };

      updateDocumentNonBlocking(costRef, updatedData);

      toast({
        title: 'Cost Updated',
        description: `The operating cost has been successfully updated.`,
      });
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not update the cost. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="itemId" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Item</FormLabel>
                        <Combobox
                            options={costItems?.map(i => ({ value: i.id, label: i.name })) || []}
                            value={field.value} onChange={field.onChange}
                            placeholder="Select an item" searchPlaceholder="Search items..." emptyText="No items found."
                            disabled={itemsLoading}
                        />
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (৳)</FormLabel><FormControl><Input type="number" placeholder="5000" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Monthly office rent" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem><FormLabel>Reference</FormLabel><FormControl><Input placeholder="e.g., Invoice #123" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
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
