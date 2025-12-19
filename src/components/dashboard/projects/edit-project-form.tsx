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
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project } from '@/lib/types';

const editProjectFormSchema = z.object({
  projectName: z.string().min(2, {
    message: 'Project name must be at least 2 characters.',
  }),
  location: z.string().min(2, {
    message: 'Location must be at least 2 characters.',
  }),
  estimatedBudget: z.coerce
    .number()
    .min(1, { message: 'Estimated budget must be greater than 0.' }),
  startDate: z.string().min(1, {
    message: 'A start date is required.',
  }),
  status: z.enum(['Planning', 'Ongoing', 'Completed']),
});

type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

interface EditProjectFormProps {
  project: Project;
  setDialogOpen: (open: boolean) => void;
}

export function EditProjectForm({ project, setDialogOpen }: EditProjectFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: {
      projectName: project.projectName,
      location: project.location,
      estimatedBudget: project.estimatedBudget,
      startDate: new Date(project.startDate).toISOString().split('T')[0],
      status: project.status,
    },
  });

  async function onSubmit(data: EditProjectFormValues) {
    try {
      const projectRef = doc(firestore, 'projects', project.id);
      
      const updatedProjectData = {
        projectName: data.projectName,
        location: data.location,
        status: data.status,
        estimatedBudget: data.estimatedBudget,
        startDate: new Date(data.startDate).toISOString(),
      };

      updateDocumentNonBlocking(projectRef, updatedProjectData);

      toast({
        title: 'Project Updated',
        description: `${data.projectName} has been successfully updated.`,
      });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating project: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not update the project. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="projectName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., Greenfield Apartments" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Dhaka" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Budget (৳)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="E.g., 50000000"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                   <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Please use YYYY-MM-DD format.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
