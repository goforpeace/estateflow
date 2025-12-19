
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
  useFirestore,
  useCollection,
  useMemoFirebase,
  updateDocumentNonBlocking,
} from '@/firebase';
import {
  collection,
  doc,
  writeBatch,
  query,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project, Flat } from '@/lib/types';
import { useEffect, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
  flats: z
    .array(
      z.object({
        id: z.string().optional(), // Existing flats will have an ID
        flatNumber: z.string().min(1, { message: 'Cannot be empty.' }),
        ownership: z.enum(['Developer', 'Landowner']),
        flatSize: z.coerce.number().min(1, { message: 'Must be > 0.' }),
        status: z.enum(['Available', 'Sold', 'Reserved']).default('Available'),
      })
    )
    .min(1, { message: 'You must have at least one flat.' }),
});

type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

interface EditProjectFormProps {
  project: Project;
  setDialogOpen: (open: boolean) => void;
}

export function EditProjectForm({
  project,
  setDialogOpen,
}: EditProjectFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [flatsToDelete, setFlatsToDelete] = useState<string[]>([]);

  // Fetch existing flats for the project
  const flatsQuery = useMemoFirebase(
    () => collection(firestore, 'projects', project.id, 'flats'),
    [firestore, project.id]
  );
  const { data: initialFlats, isLoading: flatsLoading } =
    useCollection<Flat>(flatsQuery);

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: {
      projectName: project.projectName,
      location: project.location,
      estimatedBudget: project.estimatedBudget,
      startDate: new Date(project.startDate).toISOString().split('T')[0],
      status: project.status,
      flats: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'flats',
  });

  // When initialFlats are loaded, reset the form with those values
  useEffect(() => {
    if (initialFlats) {
      form.reset({
        projectName: project.projectName,
        location: project.location,
        estimatedBudget: project.estimatedBudget,
        startDate: new Date(project.startDate).toISOString().split('T')[0],
        status: project.status,
        flats: initialFlats.map(flat => ({
            id: flat.id,
            flatNumber: flat.flatNumber,
            flatSize: flat.flatSize,
            ownership: flat.ownership,
            status: flat.status,
        })),
      });
    }
  }, [initialFlats, form, project]);

  const handleRemoveFlat = (index: number) => {
    const flatId = fields[index].id;
    if (flatId) {
      // If it's an existing flat, mark it for deletion
      setFlatsToDelete(prev => [...prev, flatId]);
    }
    // Remove from the form array
    remove(index);
  };


  async function onSubmit(data: EditProjectFormValues) {
    try {
      const batch = writeBatch(firestore);
      const projectRef = doc(firestore, 'projects', project.id);

      // 1. Update the main project document
      batch.update(projectRef, {
        projectName: data.projectName,
        location: data.location,
        status: data.status,
        estimatedBudget: data.estimatedBudget,
        startDate: new Date(data.startDate).toISOString(),
        totalFlats: data.flats.length,
      });

      // 2. Process flats: update existing, add new ones
      data.flats.forEach(flatData => {
        let flatRef;
        if (flatData.id) {
          // Existing flat: update it
          flatRef = doc(firestore, 'projects', project.id, 'flats', flatData.id);
          batch.update(flatRef, {
            flatNumber: flatData.flatNumber,
            flatSize: flatData.flatSize,
            ownership: flatData.ownership,
          });
        } else {
          // New flat: create it
          flatRef = doc(collection(firestore, 'projects', project.id, 'flats'));
          batch.set(flatRef, {
            id: flatRef.id,
            projectId: project.id,
            flatNumber: flatData.flatNumber,
            flatSize: flatData.flatSize,
            ownership: flatData.ownership,
            status: 'Available', // Default for new flats
          });
        }
      });

      // 3. Delete flats marked for deletion
      flatsToDelete.forEach(flatId => {
        const flatRef = doc(firestore, 'projects', project.id, 'flats', flatId);
        batch.delete(flatRef);
      });


      // Commit the batch
      await batch.commit();

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
                    <Input
                      placeholder="E.g., Greenfield Apartments"
                      {...field}
                    />
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
            <Separator />
            <div>
              <FormLabel>Available Flats</FormLabel>
              <FormDescription>
                Manage the flats for this project.
              </FormDescription>
               {flatsLoading ? (
                <p>Loading flats...</p>
              ) : (
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
                              disabled={field.value === 'Sold' || field.value === 'Reserved'}
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
                              disabled={field.value === 'Sold' || field.value === 'Reserved'}
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
                              disabled={field.value === 'Sold' || field.value === 'Reserved'}
                            >
                              <FormItem className="flex items-center space-x-1 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="Developer" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Dev
                                </FormLabel>
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
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            disabled={fields[index].status === 'Sold' || fields[index].status === 'Reserved'}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the flat
                            and all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveFlat(index)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
              )}
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
                append({ flatNumber: '', ownership: 'Developer', flatSize: 0, status: 'Available' })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Another Flat
            </Button>
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting || flatsLoading}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
