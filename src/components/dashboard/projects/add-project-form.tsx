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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';

const projectFormSchema = z.object({
  projectName: z.string().min(2, {
    message: 'Project name must be at least 2 characters.',
  }),
  location: z.string().min(2, {
    message: 'Location must be at least 2 characters.',
  }),
  totalFlats: z.coerce.number().min(1, { message: 'Must be at least 1.' }),
  developerShare: z.coerce
    .number()
    .min(0, { message: 'Cannot be negative.' })
    .max(100, { message: 'Cannot exceed 100.' }),
  landownerShare: z.coerce
    .number()
    .min(0, { message: 'Cannot be negative.' })
    .max(100, { message: 'Cannot exceed 100.' }),
  startDate: z.date({
    required_error: 'A start date is required.',
  }),
  status: z.enum(['Planning', 'Ongoing', 'Completed']),
}).refine(data => data.developerShare + data.landownerShare === 100, {
    message: "Developer and Landowner shares must add up to 100%.",
    path: ["landownerShare"],
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface AddProjectFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function AddProjectForm({ setDialogOpen }: AddProjectFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      projectName: '',
      location: '',
      totalFlats: 1,
      developerShare: 50,
      landownerShare: 50,
      status: 'Planning',
    },
  });

  async function onSubmit(data: ProjectFormValues) {
    try {
      const projectsCollection = collection(firestore, 'projects');
      const newDocRef = doc(projectsCollection);
      
      const newProject = {
        ...data,
        id: newDocRef.id,
        startDate: data.startDate.toISOString(),
      };
      
      // Using non-blocking add
      addDocumentNonBlocking(projectsCollection, newProject);

      toast({
        title: 'Project Added',
        description: `${data.projectName} has been successfully created.`,
      });
      form.reset();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding project: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not add the project. ' + error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input placeholder="E.g., Bangalore" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalFlats"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Flats</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="developerShare"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Developer Share (%)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="landownerShare"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Landowner Share (%)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Adding...' : 'Add Project'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
