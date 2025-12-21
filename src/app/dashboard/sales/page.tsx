
'use client';

import { Ban, PlusCircle, Trash2, MoreHorizontal, View, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
  } from "@/components/ui/dropdown-menu"
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, doc, writeBatch } from 'firebase/firestore';
import type { Sale, Project, Flat, Customer } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EditSaleForm } from '@/components/dashboard/sales/edit-sale-form';
import { Input } from '@/components/ui/input';

type EnrichedSale = Sale & {
    projectName: string;
    flatNumber: string;
    customerName: string;
};

const ITEMS_PER_PAGE = 15;

export default function SalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [enrichedSales, setEnrichedSales] = useState<EnrichedSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDataDirty, setIsDataDirty] = useState(true); // Start as true to trigger initial fetch

  const handleEditClick = (sale: EnrichedSale) => {
    // Find the original sale object to pass to the form
    const originalSale = sales.find(s => s.id === sale.id);
    if (originalSale) {
        setEditingSale(originalSale);
        setIsEditDialogOpen(true);
    } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not find the original sale record to edit.",
        });
    }
  };

  useEffect(() => {
    if (!isDataDirty || !firestore) return;

    const fetchAndEnrichSales = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch all data concurrently
        const salesQuery = query(collection(firestore, 'sales'));
        const projectsQuery = query(collection(firestore, 'projects'));
        const customersQuery = query(collection(firestore, 'customers'));

        const [salesSnap, projectsSnap, customersSnap] = await Promise.all([
          getDocs(salesQuery),
          getDocs(projectsQuery),
          getDocs(customersQuery),
        ]);

        const salesData = salesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
        setSales(salesData);

        // 2. Create lookup maps
        const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data() as Project]));
        const customersMap = new Map(customersSnap.docs.map(d => [d.id, d.data() as Customer]));
        
        // 3. Fetch all flats from all projects
        const allFlatsMap = new Map<string, Flat>();
        for (const project of projectsMap.values()) {
            const flatsQuery = query(collection(firestore, `projects/${project.id}/flats`));
            const flatsSnap = await getDocs(flatsQuery);
            flatsSnap.forEach(doc => {
                allFlatsMap.set(doc.id, doc.data() as Flat);
            });
        }

        // 4. Synchronously enrich sales data
        const enriched = salesData.map(sale => ({
          ...sale,
          projectName: projectsMap.get(sale.projectId)?.projectName || 'N/A',
          flatNumber: allFlatsMap.get(sale.flatId)?.flatNumber || 'N/A',
          customerName: customersMap.get(sale.customerId)?.fullName || 'N/A',
        })).sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

        setEnrichedSales(enriched);
      } catch (error) {
        console.error("Error fetching and enriching sales:", error);
        toast({
          variant: 'destructive',
          title: "Error loading sales",
          description: "Could not fetch all required data from the database."
        });
        setEnrichedSales([]); // Clear data on error
      }
      setIsLoading(false);
      setIsDataDirty(false);
    };

    fetchAndEnrichSales();
  }, [firestore, toast, isDataDirty]);
  
  const handleDeleteSale = async (sale: Sale) => {
    try {
        const batch = writeBatch(firestore);

        // 1. Reference to the sale document to be deleted
        const saleRef = doc(firestore, 'sales', sale.id);
        batch.delete(saleRef);

        // 2. Reference to the flat to update its status
        const flatRef = doc(firestore, 'projects', sale.projectId, 'flats', sale.flatId);
        batch.update(flatRef, { status: 'Available' });
        
        await batch.commit();

        setIsDataDirty(true); // Trigger a re-fetch

        toast({
            title: "Sale Deleted",
            description: "The sale has been successfully deleted and the flat status is now 'Available'.",
        });
    } catch (error: any) {
        console.error("Error deleting sale:", error);
        toast({
            variant: "destructive",
            title: "Error Deleting Sale",
            description: error.message,
        });
    }
  };


  const formatCurrency = (value: number) => {
    if (!value) return 'N/A';
    if (Math.abs(value) >= 10000000) {
      return `৳${(value / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(value) >= 100000) {
      return `৳${(value / 100000).toFixed(2)} Lacs`;
    }
    return `৳${value.toLocaleString('en-IN')}`;
  };

  const filteredSales = useMemo(() => {
    if (!enrichedSales) return [];
    const searchTerm = searchQuery.toLowerCase();
    return enrichedSales.filter(sale =>
        sale.customerName.toLowerCase().includes(searchTerm) ||
        sale.projectName.toLowerCase().includes(searchTerm) ||
        sale.flatNumber.toLowerCase().includes(searchTerm)
    );
  }, [enrichedSales, searchQuery]);

  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = filteredSales.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle>Sales</CardTitle>
              <CardDescription>
                Manage all your property sales.
              </CardDescription>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
                 <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search sales..."
                        className="pl-8 sm:w-full lg:w-[300px]"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                 <Button asChild className="w-full sm:w-auto">
                    <Link href="/dashboard/sales/add">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Sale
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading sales...</p>
            </div>
          )}
          {!isLoading && !paginatedSales.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No sales found.</p>
              <p className="text-sm">
                {searchQuery ? 'Try a different search term or' : 'Click "Add Sale" to'} record a new sale.
              </p>
            </div>
          )}
          {!isLoading && paginatedSales.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {sale.customerName}
                        </TableCell>
                        <TableCell>{sale.projectName}</TableCell>
                        <TableCell>{sale.flatNumber}</TableCell>
                        <TableCell>{new Date(sale.saleDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sale.totalPrice)}</TableCell>
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
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/sales/${sale.id}`}>
                                        <View className="mr-2 h-4 w-4" />
                                        View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClick(sale)}>
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
                                  This will permanently delete this sale record and set the corresponding flat's status back to 'Available'.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSale(sale)}
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
        {editingSale && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                <DialogTitle>Edit Sale</DialogTitle>
                </DialogHeader>
                <EditSaleForm 
                    sale={editingSale} 
                    setDialogOpen={setIsEditDialogOpen} 
                    onSaleUpdated={() => setIsDataDirty(true)}
                />
            </DialogContent>
            </Dialog>
        )}
    </div>
  );
}

  