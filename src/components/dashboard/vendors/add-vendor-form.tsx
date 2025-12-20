
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
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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

interface AddVendorFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function AddVendorForm({ setDialogOpen }: AddVendorFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      vendorName: '',
      phoneNumber: '',
      enterpriseName: '',
      details: '',
    },
  });

  async function onSubmit(data: VendorFormValues) {
    try {
      const vendorsCollection = collection(firestore, 'vendors');
      const newVendorRef = doc(vendorsCollection);

      const newVendor = {
        id: newVendorRef.id,
        ...data,
      };

      addDocumentNonBlocking(vendorsCollection, newVendor);

      toast({
        title: 'Vendor Added',
        description: `${data.vendorName} has been successfully created.`,
      });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding vendor: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not add the vendor. ' + error.message,
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
            {form.formState.isSubmitting ? 'Adding...' : 'Add Vendor'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

