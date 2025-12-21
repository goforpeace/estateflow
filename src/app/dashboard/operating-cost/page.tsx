
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
import { Combobox } from '@/components/ui/combobox';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo, useCallback } from 'react';
import type { OperatingCost, OperatingCostItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Search, Ban, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  } from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddOperatingCostItemForm } from '@/components/dashboard/operating-cost/add-item-form';
import { EditOperatingCostForm } from '@/components/dashboard/operating-cost/edit-cost-form';
import { OperatingCostDetails } from '@/components/dashboard/operating-cost/cost-details';

const addCostFormSchema = z.object({
  date: z.string().min(1, { message: 'Expense date is required.' }),
  itemId: z.string().min(1, { message: 'Please select an item.' }),
  description: z.string().optional(),
  reference: z.string().optional(),
  amount: z.coerce.number().min(1, { message: 'Amount must be greater than 0.' }),
});

type AddCostFormValues = z.infer<typeof addCostFormSchema>;

export type EnrichedOperatingCost = OperatingCost & {
    itemName: string;
}

const ITEMS_PER_PAGE = 10;

export default function OperatingCostPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  
  // Data for forms and list
  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'operatingCostItems')), [firestore]);
  const { data: costItems, isLoading: itemsLoading, error: itemsError } = useCollection<OperatingCostItem>(itemsQuery);

  const costsQuery = useMemoFirebase(() => query(collection(firestore, 'operatingCosts')), [firestore]);
  const { data: operatingCosts, isLoading: costsLoading, error: costsError } = useCollection<OperatingCost>(costsQuery);

  // State for UI management
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCost, setSelectedCost] = useState<EnrichedOperatingCost | null>(null);

  const form = useForm<AddCostFormValues>({
    resolver: zodResolver(addCostFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      itemId: '',
      description: '',
      reference: '',
      amount: 0,
    },
  });

  async function onSubmit(data: AddCostFormValues) {
    try {
      const costsCollection = collection(firestore, 'operatingCosts');
      const newCostRef = doc(costsCollection);
      
      const newCost = {
        id: newCostRef.id,
        ...data,
        date: new Date(data.date).toISOString(),
      };
      
      addDocumentNonBlocking(costsCollection, newCost);

      toast({
        title: 'Operating Cost Added',
        description: `The expense has been successfully recorded.`,
      });
      form.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not record the expense. ' + error.message,
      });
    }
  }
  
  const handleEdit = useCallback((cost: EnrichedOperatingCost) => {
    setSelectedCost(cost);
    setIsEditDialogOpen(true);
  }, []);

  const handleView = useCallback((cost: EnrichedOperatingCost) => {
    setSelectedCost(cost);
    setIsViewDialogOpen(true);
  }, []);
  
  const handleDelete = useCallback((cost: EnrichedOperatingCost) => {
    setSelectedCost(cost);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = () => {
    if (!selectedCost) return;
    const costRef = doc(firestore, 'operatingCosts', selectedCost.id);
    deleteDocumentNonBlocking(costRef);
    toast({ title: "Operating Cost Deleted" });
    setIsDeleteDialogOpen(false);
    setSelectedCost(null);
  };

  const enrichedCosts = useMemo(() => {
    if (!operatingCosts || !costItems) return [];
    const itemsMap = new Map(costItems.map(item => [item.id, item.name]));
    return operatingCosts.map(cost => ({
      ...cost,
      itemName: itemsMap.get(cost.itemId) || 'Unknown Item',
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [operatingCosts, costItems]);

  const filteredCosts = useMemo(() => {
    const searchTerm = searchQuery.toLowerCase();
    return enrichedCosts.filter(cost => 
        cost.itemName.toLowerCase().includes(searchTerm) ||
        (cost.description || '').toLowerCase().includes(searchTerm) ||
        (cost.reference || '').toLowerCase().includes(searchTerm) ||
        cost.amount.toString().includes(searchTerm)
    );
  }, [enrichedCosts, searchQuery]);
  
  const totalOperatingCost = useMemo(() => {
    return filteredCosts.reduce((total, cost) => total + cost.amount, 0);
  }, [filteredCosts]);

  const paginatedCosts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCosts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCosts, currentPage]);

  const totalPages = Math.ceil(filteredCosts.length / ITEMS_PER_PAGE);

  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Add Operating Cost</CardTitle>
                <CardDescription>Record a general business expense.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormItem className="flex flex-col">
                                <FormLabel>Item</FormLabel>
                                <div className="flex items-center gap-2">
                                    <FormField control={form.control} name="itemId" render={({ field }) => (
                                        <div className="flex-grow">
                                            <Combobox
                                                options={costItems?.map(i => ({ value: i.id, label: i.name })) || []}
                                                value={field.value} onChange={field.onChange}
                                                placeholder="Select an item" searchPlaceholder="Search items..." emptyText="No items found."
                                                disabled={itemsLoading}
                                            />
                                        </div>
                                    )}/>
                                    <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="outline" size="icon"><PlusCircle className="h-4 w-4" /></Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader><DialogTitle>Add New Item</DialogTitle></DialogHeader>
                                            <AddOperatingCostItemForm setDialogOpen={setIsAddItemDialogOpen} />
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                <FormMessage>{form.formState.errors.itemId?.message}</FormMessage>
                            </FormItem>
                             <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem><FormLabel>Amount (৳)</FormLabel><FormControl><Input type="number" placeholder="5000" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Monthly office rent" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="reference" render={({ field }) => (
                                <FormItem><FormLabel>Reference</FormLabel><FormControl><Input placeholder="e.g., Invoice #123" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Recording...' : 'Record Cost'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                 <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <CardTitle>Operating Cost Log</CardTitle>
                        <CardDescription>
                            Total for selection: <span className="font-semibold text-primary">{formatCurrency(totalOperatingCost)}</span>
                        </CardDescription>
                    </div>
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search by item, description..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                 </div>
            </CardHeader>
            <CardContent>
                 {(costsLoading || itemsLoading) && <p>Loading costs...</p>}
                 {paginatedCosts.length === 0 && !(costsLoading || itemsLoading) && (
                    <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Ban className="h-12 w-12 mb-2" />
                        <p className="text-lg font-semibold">No costs found.</p>
                        <p className="text-sm">Record a new cost to see it here.</p>
                    </div>
                 )}
                 {paginatedCosts.length > 0 && (
                    <>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {paginatedCosts.map(cost => (
                                    <TableRow key={cost.id}>
                                        <TableCell>{new Date(cost.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-medium">{cost.itemName}</TableCell>
                                        <TableCell className="max-w-[300px] truncate">{cost.description}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(cost.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => handleView(cost)}><Eye className="mr-2 h-4 w-4"/>View</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleEdit(cost)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => handleDelete(cost)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                        </div>
                    </>
                 )}
            </CardContent>
        </Card>
        
        {/* Dialogs */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent><DialogHeader><DialogTitle>Cost Details</DialogTitle></DialogHeader>{selectedCost && <OperatingCostDetails cost={selectedCost} />}</DialogContent>
        </Dialog>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent><DialogHeader><DialogTitle>Edit Operating Cost</DialogTitle></DialogHeader>{selectedCost && <EditOperatingCostForm cost={selectedCost} setDialogOpen={setIsEditDialogOpen} />}</DialogContent>
        </Dialog>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this cost record. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedCost(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
