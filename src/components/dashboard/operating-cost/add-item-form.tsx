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
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const addItemFormSchema = z.object({
  name: z.string().min(2, { message: 'Item name must be at least 2 characters.' }),
});
type AddItemFormValues = z.infer<typeof addItemFormSchema>;

interface AddOperatingCostItemFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function AddOperatingCostItemForm({ setDialogOpen }: AddOperatingCostItemFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemFormSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(data: AddItemFormValues) {
    try {
      const itemsCollection = collection(firestore, 'operatingCostItems');
      const newItemRef = doc(itemsCollection);
      addDocumentNonBlocking(itemsCollection, {
        id: newItemRef.id,
        name: data.name
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
                <Input placeholder="e.g., Office Rent" {...field} />
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
