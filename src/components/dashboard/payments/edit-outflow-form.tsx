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
import { useFirestore } from '@/firebase';
import { collection, query, where, doc, runTransaction, getDocs, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { OutflowTransaction, Expense } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EnrichedOutflow } from '@/app/dashboard/make-payment/page';

const editOutflowSchema = z.object({
  amount: z.coerce.number().min(1, { message: 'Amount must be greater than 0.' }),
  date: z.string().min(1, { message: 'Payment date is required.' }),
  paymentMethod: z.enum(['Cash', 'Cheque', 'Bank Transfer']),
  reference: z.string().optional(),
});

type EditOutflowFormValues = z.infer<typeof editOutflowSchema>;

interface EditOutflowFormProps {
  payment: EnrichedOutflow;
  setDialogOpen: (open: boolean) => void;
  onUpdate: () => void;
}

export function EditOutflowForm({ payment, setDialogOpen, onUpdate }: EditOutflowFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<EditOutflowFormValues>({
    resolver: zodResolver(editOutflowSchema),
    defaultValues: {
      amount: payment.amount,
      date: new Date(payment.date).toISOString().split('T')[0],
      paymentMethod: payment.paymentMethod || 'Cash',
      reference: payment.reference || '',
    },
  });

  async function onSubmit(data: EditOutflowFormValues) {
    if (!payment.projectId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Project ID is missing.' });
        return;
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const paymentRef = doc(firestore, 'projects', payment.projectId!, 'outflowTransactions', payment.id);
            
            if (payment.expenseId) {
                const expenseQuery = query(collection(firestore, 'expenses'), where('expenseId', '==', payment.expenseId), limit(1));
                const expenseSnap = await getDocs(expenseQuery);

                if (expenseSnap.empty) throw new Error(`Expense with ID ${payment.expenseId} not found.`);

                const expenseDoc = expenseSnap.docs[0];
                const expenseData = expenseDoc.data() as Expense;

                const amountDifference = data.amount - payment.amount;
                const newPaidAmount = expenseData.paidAmount + amountDifference;

                if (newPaidAmount > expenseData.price) {
                    throw new Error('Payment cannot exceed the total expense price.');
                }
                
                const newStatus = newPaidAmount >= expenseData.price ? 'Paid' : 'Partially Paid';
                
                transaction.update(expenseDoc.ref, { paidAmount: newPaidAmount, status: newStatus });
            }

            transaction.update(paymentRef, {
                ...data,
                date: new Date(data.date).toISOString(),
            });
        });

      toast({ title: 'Payment Updated', description: `The payment has been successfully updated.` });
      onUpdate();
      setDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error updating payment', description: error.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Vendor</p>
                    <p>{payment.supplierVendor}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Expense ID</p>
                    <p className="font-mono">{payment.expenseId || 'N/A'}</p>
                </div>
             </div>
            <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Amount (৳)</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
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
                        />
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

    