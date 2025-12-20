
'use client';

import { Ban, PlusCircle, Trash2, MoreHorizontal, View } from 'lucide-react';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, doc, writeBatch } from 'firebase/firestore';
import type { Sale, Project, Flat, Customer } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type EnrichedSale = Sale & {
    projectName: string;
    flatNumber: string;
    customerName: string;
};

export default function SalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const salesQuery = useMemoFirebase(
    () => query(collection(firestore, 'sales')),
    [firestore]
  );
  const { data: sales, isLoading } = useCollection<Sale>(salesQuery);
  const [enrichedSales, setEnrichedSales] = useState<EnrichedSale[]>([]);

  useEffect(() => {
    const enrichSales = async () => {
        if (!sales) {
          setEnrichedSales([]);
          return;
        };

        const projectIds = [...new Set(sales.map(s => s.projectId))];
        const customerIds = [...new Set(sales.map(s => s.customerId))];

        const projectsPromise = projectIds.length ? getDocs(query(collection(firestore, 'projects'))) : Promise.resolve({ docs: [] });
        const customersPromise = customerIds.length ? getDocs(query(collection(firestore, 'customers'))) : Promise.resolve({ docs: [] });

        const [projectsSnap, customersSnap] = await Promise.all([projectsPromise, customersPromise]);

        const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data() as Project]));
        const customersMap = new Map(customersSnap.docs.map(d => [d.id, d.data() as Customer]));
        
        const flatPromises = sales.map(sale => getDocs(query(collection(firestore, `projects/${sale.projectId}/flats`))));
        const flatSnaps = await Promise.all(flatPromises);
        const flatsMap = new Map<string, Flat>();
        flatSnaps.forEach(snap => {
            snap.docs.forEach(doc => {
              if (!flatsMap.has(doc.id)) {
                flatsMap.set(doc.id, doc.data() as Flat)
              }
            });
        });

        const enriched = sales.map(sale => ({
            ...sale,
            projectName: projectsMap.get(sale.projectId)?.projectName || 'N/A',
            flatNumber: flatsMap.get(sale.flatId)?.flatNumber || 'N/A',
            customerName: customersMap.get(sale.customerId)?.fullName || 'N/A',
        }));

        setEnrichedSales(enriched);
    };

    enrichSales();
  }, [sales, firestore]);
  
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sales</CardTitle>
              <CardDescription>
                Manage all your property sales.
              </CardDescription>
            </div>
            <Button asChild>
                <Link href="/dashboard/sales/add">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Sale
                </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading sales...</p>
            </div>
          )}
          {!isLoading && !enrichedSales?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No sales found.</p>
              <p className="text-sm">
                Click &quot;Add Sale&quot; to record a new sale.
              </p>
            </div>
          )}
          {!isLoading && enrichedSales && enrichedSales.length > 0 && (
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
                  {enrichedSales.map(sale => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
