
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
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Vendor } from '@/lib/types';

const vendorFormSchema = z.object({
  vendorName: z.string().min(2, {
    message: 'Vendor name must be at least 2 characters.',
  }),
  phoneNumber: z.string().min(11, {
    message: 'Phone number must be at least 11 digits.',
  }),
  enterpriseName: z.string().min(2, {
    message: 'Enterprise name must be at least 2 characters.',
  }),
  details: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

interface EditVendorFormProps {
  vendor: Vendor;
  setDialogOpen: (open: boolean) => void;
}

export function EditVendorForm({ vendor, setDialogOpen }: EditVendorFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      vendorName: vendor.vendorName,
      phoneNumber: vendor.phoneNumber,
      enterpriseName: vendor.enterpriseName,
      details: vendor.details || '',
    },
  });

  async function onSubmit(data: VendorFormValues) {
    try {
      const vendorRef = doc(firestore, 'vendors', vendor.id);
      
      updateDocumentNonBlocking(vendorRef, data);

      toast({
        title: 'Vendor Updated',
        description: `${data.vendorName}'s information has been successfully updated.`,
      });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating vendor: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not update the vendor. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="vendorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., Abul Kashem" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., 01712345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="enterpriseName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enterprise Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., Kashem Traders" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Details</FormLabel>
                <FormControl>
                  <Textarea placeholder="e.g., Specializes in cement supply" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

