
'use client';

import { Ban, PlusCircle, Pencil, Trash2, MoreHorizontal, Search, Eye, Download } from 'lucide-react';
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
  DialogTrigger,
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
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import type { Vendor } from '@/lib/types';
import { AddVendorForm } from '@/components/dashboard/vendors/add-vendor-form';
import { EditVendorForm } from '@/components/dashboard/vendors/edit-vendor-form';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { exportToCsv } from '@/lib/csv';

const ITEMS_PER_PAGE = 15;

export default function VendorsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const vendorsQuery = useMemoFirebase(
    () => query(collection(firestore, 'vendors')),
    [firestore]
  );
  const { data: vendors, isLoading } = useCollection<Vendor>(vendorsQuery);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleEditClick = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteVendor = (vendorId: string) => {
    const vendorRef = doc(firestore, 'vendors', vendorId);
    deleteDocumentNonBlocking(vendorRef);
    toast({
        title: "Vendor Deleted",
        description: "The vendor has been successfully deleted.",
    });
  };

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    const searchTerm = searchQuery.toLowerCase();
    return vendors.filter(vendor =>
        vendor.vendorName.toLowerCase().includes(searchTerm) ||
        vendor.phoneNumber.toLowerCase().includes(searchTerm) ||
        vendor.enterpriseName.toLowerCase().includes(searchTerm) ||
        (vendor.details || '').toLowerCase().includes(searchTerm)
    );
  }, [vendors, searchQuery]);

  const totalPages = Math.ceil(filteredVendors.length / ITEMS_PER_PAGE);
  const paginatedVendors = filteredVendors.slice(
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
    const dataToExport = filteredVendors.map(v => ({
      'ID': v.id,
      'Vendor Name': v.vendorName,
      'Phone Number': v.phoneNumber,
      'Enterprise Name': v.enterpriseName,
      'Details': v.details,
    }));
    exportToCsv(dataToExport, `vendors_${new Date().toISOString().split('T')[0]}.csv`);
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle>Vendors</CardTitle>
              <CardDescription>
                Manage all your vendors and suppliers.
              </CardDescription>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
                 <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search vendors..."
                        className="pl-8 sm:w-full lg:w-[300px]"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                    />
                </div>
                 <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Vendor
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>Add New Vendor</DialogTitle>
                    </DialogHeader>
                    <AddVendorForm setDialogOpen={setIsAddDialogOpen} />
                </DialogContent>
                </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading vendors...</p>
            </div>
          )}
          {!isLoading && !paginatedVendors?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No vendors found.</p>
              <p className="text-sm">
                {searchQuery ? 'Try a different search term or' : 'Click "Add Vendor" to'} get started.
              </p>
            </div>
          )}
          {!isLoading && paginatedVendors && paginatedVendors.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Enterprise</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.map(vendor => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">
                          {vendor.vendorName}
                        </TableCell>
                        <TableCell>{vendor.phoneNumber}</TableCell>
                        <TableCell>{vendor.enterpriseName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{vendor.details}</TableCell>
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
                                      <Link href={`/dashboard/vendors/${vendor.id}`}>
                                          <Eye className="mr-2 h-4 w-4" />
                                          View Details
                                      </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClick(vendor)}>
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
                                    This action cannot be undone. This will permanently delete this vendor.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteVendor(vendor.id)}
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
      {editingVendor && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
            </DialogHeader>
            <EditVendorForm vendor={editingVendor} setDialogOpen={setIsEditDialogOpen} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
