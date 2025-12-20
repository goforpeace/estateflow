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
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import type { InflowTransaction, Customer, Project, Flat } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

const editPaymentFormSchema = z.object({
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

type EditPaymentFormValues = z.infer<typeof editPaymentFormSchema>;

interface EditPaymentFormProps {
  payment: InflowTransaction;
  setDialogOpen: (open: boolean) => void;
  onUpdate: () => void; // Callback to refresh the list
}

export function EditPaymentForm({ payment, setDialogOpen, onUpdate }: EditPaymentFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<EditPaymentFormValues>({
    resolver: zodResolver(editPaymentFormSchema),
    defaultValues: {
      ...payment,
      date: new Date(payment.date).toISOString().split('T')[0],
    },
  });

  const paymentPurpose = form.watch('paymentPurpose');

  async function onSubmit(data: EditPaymentFormValues) {
    try {
      const paymentRef = doc(firestore, 'projects', data.projectId, 'inflowTransactions', payment.id);
      
      const updatedData = {
        ...data,
        paymentType: data.paymentPurpose === 'Booking Money' ? 'Booking' : 'Installment',
        date: new Date(data.date).toISOString(),
      };

      updateDocumentNonBlocking(paymentRef, updatedData);

      toast({
        title: 'Payment Updated',
        description: `The payment record has been successfully updated.`,
      });
      onUpdate();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating payment: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not update the payment. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Editing Payment for Receipt ID: <span className="font-mono">{payment.receiptId}</span>
                </p>
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
                <FormField
                    control={form.control}
                    name="paymentPurpose"
                    render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Purpose of Payment</FormLabel>
                        <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
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
                <p className="text-xs text-muted-foreground pt-4">
                    Customer, Project, and Flat cannot be changed after a payment is created. To change these, please delete this record and create a new one.
                </p>
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
