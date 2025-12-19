'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  useFirestore,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';


const projectFormSchema = z.object({
  projectName: z.string().min(2, {
    message: 'Project name must be at least 2 characters.',
  }),
  location: z.string().min(2, {
    message: 'Location must be at least 2 characters.',
  }),
  estimatedBudget: z.coerce
    .number()
    .min(1, { message: 'Estimated budget must be greater than 0.' }),
  startDate: z.date({
    required_error: 'A start date is required.',
  }),
  status: z.enum(['Planning', 'Ongoing', 'Completed']),
  flats: z
    .array(
      z.object({
        flatNumber: z.string().min(1, { message: 'Cannot be empty.' }),
        ownership: z.enum(['Developer', 'Landowner']),
        flatSize: z.coerce.number().min(1, { message: 'Must be > 0.' }),
      })
    )
    .min(1, { message: 'You must add at least one flat.' }),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface AddProjectFormProps {
  setDialogOpen: (open: boolean) => void;
}

export function AddProjectForm({ setDialogOpen }: AddProjectFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      projectName: '',
      location: '',
      estimatedBudget: 0,
      status: 'Planning',
      flats: [{ flatNumber: '', ownership: 'Developer', flatSize: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'flats',
  });

  async function onSubmit(data: ProjectFormValues) {
    try {
      const projectsCollection = collection(firestore, 'projects');
      const newProjectRef = doc(projectsCollection);

      const newProject = {
        id: newProjectRef.id,
        projectName: data.projectName,
        location: data.location,
        totalFlats: data.flats.length,
        startDate: data.startDate.toISOString(),
        status: data.status,
        estimatedBudget: data.estimatedBudget,
      };

      // Create a batch to write all documents atomically
      const batch = writeBatch(firestore);

      // 1. Set the main project document
      batch.set(newProjectRef, newProject);

      // 2. Set each flat document in the subcollection
      data.flats.forEach(flatData => {
        const flatRef = doc(
          collection(firestore, 'projects', newProjectRef.id, 'flats')
        );
        batch.set(flatRef, {
          id: flatRef.id,
          projectId: newProjectRef.id,
          flatNumber: flatData.flatNumber,
          ownership: flatData.ownership,
          flatSize: flatData.flatSize,
          status: 'Available', // Default status for new flats
        });
      });

      // Commit the batch
      await batch.commit();

      toast({
        title: 'Project Added',
        description: `${data.projectName} has been successfully created with ${data.flats.length} flats.`,
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
                    <Input placeholder="E.g., Bangalore" {...field} />
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
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
                        onSelect={(date) => {
                          field.onChange(date);
                          setIsCalendarOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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

          <Separator />

          <div>
            <FormLabel>Available Flats</FormLabel>
            <FormDescription>
              Add the flat numbers and their ownership.
            </FormDescription>
            <div className="space-y-4 mt-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2 p-3 border rounded-lg"
                >
                  <FormField
                    control={form.control}
                    name={`flats.${index}.flatNumber`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={cn(index !== 0 && 'sr-only')}>
                          Flat Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`E.g., A-${101 + index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`flats.${index}.flatSize`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={cn(index !== 0 && 'sr-only')}>
                          Flat Size (SFT)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            placeholder="E.g., 1200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`flats.${index}.ownership`}
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className={cn(index !== 0 && 'sr-only')}>
                          Ownership
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex items-center space-x-2"
                          >
                            <FormItem className="flex items-center space-x-1 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Developer" />
                              </FormControl>
                              <FormLabel className="font-normal">Dev</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-1 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Landowner" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Owner
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {form.formState.errors.flats &&
              !form.formState.errors.flats.root && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {form.formState.errors.flats.message}
                </p>
              )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                append({ flatNumber: '', ownership: 'Developer', flatSize: 0 })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Another Flat
            </Button>
          </div>
        </div>
        </ScrollArea>
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Adding...' : 'Add Project'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
