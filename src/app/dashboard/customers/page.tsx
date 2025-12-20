
'use client';

import { Ban, PlusCircle, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
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
import type { Customer } from '@/lib/types';
import { AddCustomerForm } from '@/components/dashboard/customers/add-customer-form';
import { EditCustomerForm } from '@/components/dashboard/customers/edit-customer-form';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';


export default function CustomersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const customersQuery = useMemoFirebase(
    () => query(collection(firestore, 'customers')),
    [firestore]
  );
  const { data: customers, isLoading } = useCollection<Customer>(customersQuery);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteCustomer = (customerId: string) => {
    const customerRef = doc(firestore, 'customers', customerId);
    deleteDocumentNonBlocking(customerRef);
    toast({
        title: "Customer Deleted",
        description: "The customer has been successfully deleted.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                Manage all your customers.
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                </DialogHeader>
                <AddCustomerForm setDialogOpen={setIsAddDialogOpen} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading customers...</p>
            </div>
          )}
          {!isLoading && !customers?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No customers found.</p>
              <p className="text-sm">
                Click &quot;Add Customer&quot; to get started.
              </p>
            </div>
          )}
          {!isLoading && customers && customers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>NID Number</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.fullName}
                      </TableCell>
                      <TableCell>{customer.mobile}</TableCell>
                      <TableCell>{customer.address}</TableCell>
                      <TableCell>{customer.nidNumber}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEditClick(customer)}>
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
                                  This action cannot be undone. This will permanently delete this customer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCustomer(customer.id)}
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
      {editingCustomer && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <EditCustomerForm customer={editingCustomer} setDialogOpen={setIsEditDialogOpen} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
