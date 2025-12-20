
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
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, writeBatch, getDocs, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import type { Project, Vendor, ExpenseItem, Expense, Counter } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Search, Ban, MoreHorizontal, Pencil, Trash2, Eye, Download } from 'lucide-react';
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
  } from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditExpenseForm } from '@/components/dashboard/expenses/edit-expense-form';
import { ExpenseDetails } from '@/components/dashboard/expenses/expense-details';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { exportToCsv } from '@/lib/csv';


const addExpenseFormSchema = z.object({
  vendorId: z.string().min(1, { message: 'Please select a vendor.' }),
  projectId: z.string().min(1, { message: 'Please select a project.' }),
  itemId: z.string().min(1, { message: 'Please select an expense item.' }),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().min(1, { message: 'Price must be greater than 0.' }),
  date: z.string().min(1, { message: 'Expense date is required.' }),
  description: z.string().optional(),
});

type AddExpenseFormValues = z.infer<typeof addExpenseFormSchema>;

const addItemFormSchema = z.object({
  name: z.string().min(2, { message: 'Item name must be at least 2 characters.' }),
});
type AddItemFormValues = z.infer<typeof addItemFormSchema>;

export type EnrichedExpense = Expense & {
    vendorName: string;
    projectName: string;
    itemName: string;
}

const ITEMS_PER_PAGE = 10;

// A small form component for the "Add Item" dialog
function AddItemForm({ setDialogOpen }: { setDialogOpen: (open: boolean) => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemFormSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(data: AddItemFormValues) {
    try {
      const itemsCollection = collection(firestore, 'expenseItems');
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
                <Input placeholder="e.g., Steel Rods" {...field} />
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


export default function AddExpensePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isDataDirty, setIsDataDirty] = useState(true);
  const [expenses, setExpenses] = useState<EnrichedExpense[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState<EnrichedExpense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<EnrichedExpense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);


  // Data fetching for form
  const vendorsQuery = useMemoFirebase(() => query(collection(firestore, 'vendors')), [firestore]);
  const { data: vendors, isLoading: vendorsLoading } = useCollection<Vendor>(vendorsQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(firestore, 'projects')), [firestore]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const itemsQuery = useMemoFirebase(() => query(collection(firestore, 'expenseItems')), [firestore]);
  const { data: expenseItems, isLoading: itemsLoading } = useCollection<ExpenseItem>(itemsQuery);

  // Fetch and enrich expenses for the log
  useEffect(() => {
    // Definitive Guard: Ensure all data dependencies are loaded and available.
    if (!isDataDirty || !vendors || !projects || !expenseItems) {
      return;
    }
    
    const fetchAndEnrichExpenses = async () => {
        setIsLoadingLog(true);
        try {
            const expensesSnap = await getDocs(query(collection(firestore, 'expenses')));
            
            const vendorsMap = new Map(vendors.map(d => [d.id, d.vendorName]));
            const projectsMap = new Map(projects.map(d => [d.id, d.projectName]));
            const itemsMap = new Map(expenseItems.map(d => [d.id, d.name]));

            const enriched = expensesSnap.docs.map(doc => {
                const expense = { ...doc.data(), id: doc.id } as Expense;
                return {
                    ...expense,
                    vendorName: vendorsMap.get(expense.vendorId) || 'N/A',
                    projectName: projectsMap.get(expense.projectId) || 'N/A',
                    itemName: itemsMap.get(expense.itemId) || 'N/A',
                }
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setExpenses(enriched);

        } catch (error: any) {
            console.error("Error fetching and enriching expenses:", error);
            toast({
              variant: 'destructive',
              title: "Error loading expenses",
              description: error.message || "Could not fetch expense data from the database."
            });
            setExpenses([]);
        }
        setIsLoadingLog(false);
        setIsDataDirty(false);
    };
    
    fetchAndEnrichExpenses();

  }, [firestore, toast, isDataDirty, vendors, projects, expenseItems]);


  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseFormSchema),
    defaultValues: {
      vendorId: '',
      projectId: '',
      itemId: '',
      quantity: 1,
      price: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
    },
  });

  const getNextExpenseId = async (): Promise<string> => {
    const counterRef = doc(firestore, 'counters', 'expense');
    try {
      const newCurrent = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { current: 100 });
          return 'EXID-0100';
        }
        const currentId = (counterDoc.data() as Counter).current + 1;
        transaction.update(counterRef, { current: currentId });
        return `EXID-0${currentId}`;
      });
      return newCurrent;
    } catch (error) {
      console.error("Transaction failed: ", error);
      throw new Error("Could not generate expense ID.");
    }
  };

  async function onSubmit(data: AddExpenseFormValues) {
    try {
      const expenseId = await getNextExpenseId();
      const expenseRef = doc(collection(firestore, 'expenses'));
      
      const newExpense: Expense = {
        id: expenseRef.id,
        expenseId: expenseId,
        vendorId: data.vendorId,
        projectId: data.projectId,
        itemId: data.itemId,
        quantity: data.quantity,
        price: data.price,
        date: new Date(data.date).toISOString(),
        description: data.description,
        paidAmount: 0, // Initialize paidAmount to 0
        status: 'Unpaid', // Initialize status to Unpaid
      };
      
      // Use a non-blocking add to create the expense document
      addDocumentNonBlocking(collection(firestore, 'expenses'), newExpense);

      toast({
        title: 'Expense Recorded',
        description: `Expense ${expenseId} for ${formatCurrency(data.price)} has been logged as unpaid.`,
      });
      
      form.reset();
      setIsDataDirty(true);

    } catch (error: any) {
      console.error('Error recording expense: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not record the expense. ' + error.message,
      });
    }
  }

  const handleDeleteExpense = (expense: EnrichedExpense) => {
    const expenseRef = doc(firestore, 'expenses', expense.id);
    deleteDocumentNonBlocking(expenseRef);
    toast({
        title: "Expense Deleted",
        description: "The expense record has been successfully deleted.",
    });
    setIsDataDirty(true);
  };
  
  const handleEditClick = (expense: EnrichedExpense) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const handleViewClick = (expense: EnrichedExpense) => {
    setViewingExpense(expense);
    setIsViewDialogOpen(true);
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
        const searchTerm = searchQuery.toLowerCase();
        const searchMatch = !searchTerm || (
            exp.vendorName.toLowerCase().includes(searchTerm) ||
            exp.projectName.toLowerCase().includes(searchTerm) ||
            exp.itemName.toLowerCase().includes(searchTerm) ||
            exp.expenseId.toLowerCase().includes(searchTerm) ||
            exp.price.toString().includes(searchTerm)
        );

        const expDate = new Date(exp.date);
        const fromDate = dateRange?.from;
        const toDate = dateRange?.to;
        const dateMatch = !dateRange || (
            (!fromDate || expDate >= fromDate) &&
            (!toDate || expDate <= toDate)
        );

        return searchMatch && dateMatch;
    });
  }, [expenses, searchQuery, dateRange]);

  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleExport = () => {
    const dataToExport = filteredExpenses.map(exp => ({
        'Expense ID': exp.expenseId,
        'Date': new Date(exp.date).toLocaleDateString(),
        'Vendor': exp.vendorName,
        'Project': exp.projectName,
        'Item': exp.itemName,
        'Quantity': exp.quantity,
        'Price': exp.price,
        'Paid Amount': exp.paidAmount,
        'Status': exp.status,
    }));
    exportToCsv(dataToExport, `expenses_${new Date().toISOString().split('T')[0]}.csv`);
  };
  
  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;


  return (
    <div className="space-y-6">
        <Card>
        <CardHeader>
            <CardTitle>Add New Expense</CardTitle>
            <CardDescription>Record a new project expense. Payments are handled separately.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Details</h3>
                    <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Vendor</FormLabel>
                        <Combobox
                            options={vendors?.map(v => ({ value: v.id, label: v.vendorName })) || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select a vendor"
                            searchPlaceholder="Search vendors..."
                            emptyText="No vendors found."
                            disabled={vendorsLoading}
                        />
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Project</FormLabel>
                        <Combobox
                            options={projects?.map(p => ({ value: p.id, label: p.projectName })) || []}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select a project"
                            searchPlaceholder="Search projects..."
                            emptyText="No projects found."
                            disabled={projectsLoading}
                        />
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Expense Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Itemization</h3>
                    <FormItem className="flex flex-col">
                    <FormLabel>Item</FormLabel>
                    <div className="flex items-center gap-2">
                        <FormField
                        control={form.control}
                        name="itemId"
                        render={({ field }) => (
                            <div className="flex-grow">
                            <Combobox
                                options={expenseItems?.map(i => ({ value: i.id, label: i.name })) || []}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select an item"
                                searchPlaceholder="Search items..."
                                emptyText="No items found."
                                disabled={itemsLoading}
                            />
                            </div>
                        )}
                        />
                        <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="icon">
                            <PlusCircle className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                            <DialogTitle>Add New Expense Item</DialogTitle>
                            </DialogHeader>
                            <AddItemForm setDialogOpen={setIsAddItemDialogOpen} />
                        </DialogContent>
                        </Dialog>
                    </div>
                    <FormMessage>{form.formState.errors.itemId?.message}</FormMessage>
                    </FormItem>

                    <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="1" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Price (৳)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="5000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                </div>
                </div>

                <Separator />
                
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Add any extra details about the expense..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="flex justify-end pt-4">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Recording...' : 'Record Expense'}
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
                        <CardTitle>Expense Log</CardTitle>
                        <CardDescription>
                            A record of all project expenses.
                        </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search" 
                                placeholder="Search by ID, vendor, project..."
                                className="pl-8 sm:w-full lg:w-[300px]"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoadingLog && (
                    <div className="flex justify-center items-center h-60">
                        <p>Loading expense log...</p>
                    </div>
                )}
                {!isLoadingLog && !paginatedExpenses.length && (
                    <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Ban className="h-12 w-12 mb-2" />
                        <p className="text-lg font-semibold">No expenses found.</p>
                        <p className="text-sm">
                            {searchQuery ? 'Try a different search term or' : 'Record a new expense to'} see it here.
                        </p>
                    </div>
                )}
                {!isLoadingLog && paginatedExpenses.length > 0 && (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Expense ID</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedExpenses.map(expense => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="font-mono">{expense.expenseId}</TableCell>
                                            <TableCell className="font-medium">{expense.vendorName}</TableCell>
                                            <TableCell>{expense.itemName}</TableCell>
                                            <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    expense.status === 'Paid' ? 'default' :
                                                    expense.status === 'Partially Paid' ? 'secondary' : 'destructive'
                                                }>
                                                    {expense.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(expense.price)}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleViewClick(expense)}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleEditClick(expense)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-red-600">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete this expense record. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                            onClick={() => handleDeleteExpense(expense)}
                                                            className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                         <div className="flex items-center justify-end space-x-2 py-4">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>

        {viewingExpense && (
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Expense Details</DialogTitle>
                        <CardDescription>Viewing details for expense ID: {viewingExpense.expenseId}</CardDescription>
                    </DialogHeader>
                    <ExpenseDetails expense={viewingExpense} />
                </DialogContent>
            </Dialog>
        )}

        {editingExpense && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Expense</DialogTitle>
                        <CardDescription>Updating details for expense ID: {editingExpense.expenseId}</CardDescription>
                    </DialogHeader>
                    <EditExpenseForm 
                        expense={editingExpense} 
                        setDialogOpen={setIsEditDialogOpen}
                        onUpdate={() => setIsDataDirty(true)}
                    />
                </DialogContent>
            </Dialog>
        )}

    </div>
  );
}
