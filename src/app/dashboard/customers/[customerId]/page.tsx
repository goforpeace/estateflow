
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import type {
  Project,
  Flat,
  Sale,
  Customer,
  InflowTransaction,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Phone,
  User as UserIcon,
  Home,
  Landmark,
  Ban,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Search,
  FileDown,
  Printer
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditPaymentForm } from '@/components/dashboard/payments/edit-payment-form';
import { Receipt } from '@/components/dashboard/receipt';
import type { EnrichedTransaction } from '@/app/dashboard/add-payment/page';


type EnrichedSale = Sale & {
  projectName: string;
  flatNumber: string;
};

type CustomerDetails = {
  customer: Customer;
  sales: EnrichedSale[];
  payments: InflowTransaction[];
  totalPaid: number;
  totalPrice: number;
  totalDue: number;
};

const PAYMENTS_PER_PAGE = 10;

export default function CustomerDetailPage({
  params,
}: {
  params: { customerId: string };
}) {
  const firestore = useFirestore();
  const router = useRouter();
  const { customerId } = params;

  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for payment history management
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InflowTransaction | null>(null);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<{payment: EnrichedTransaction, customer: Customer, project: Project} | null>(null);
  const [isDataDirty, setIsDataDirty] = useState(true);

  useEffect(() => {
    if (!customerId || !firestore || !isDataDirty) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch customer and their sales records concurrently
        const customerRef = doc(firestore, 'customers', customerId);
        const salesQuery = query(
          collection(firestore, 'sales'),
          where('customerId', '==', customerId)
        );

        const [customerSnap, salesSnap] = await Promise.all([
          getDoc(customerRef),
          getDocs(salesQuery),
        ]);

        if (!customerSnap.exists()) {
          notFound();
          return;
        }

        const customerData = customerSnap.data() as Customer;
        const salesData = salesSnap.docs.map(
          d => ({ ...d.data(), id: d.id } as Sale)
        );
        
        // 2. Get unique project IDs from sales to query for payments
        const projectIds = [...new Set(salesData.map(s => s.projectId))];
        const allPayments: InflowTransaction[] = [];

        // Fetch payments from each project's subcollection
        for (const projectId of projectIds) {
          const paymentsQuery = query(
            collection(firestore, `projects/${projectId}/inflowTransactions`),
            where('customerId', '==', customerId)
          );
          const paymentsSnap = await getDocs(paymentsQuery);
          paymentsSnap.forEach(doc => {
            allPayments.push({ ...doc.data(), id: doc.id } as InflowTransaction);
          });
        }
        
        allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


        // 3. Enrich sales with project and flat info
        const enrichedSales: EnrichedSale[] = [];
        for (const sale of salesData) {
          const projectRef = doc(firestore, 'projects', sale.projectId);
          const flatRef = doc(firestore, 'projects', sale.projectId, 'flats', sale.flatId);
            
          const [projectSnap, flatSnap] = await Promise.all([
            getDoc(projectRef),
            getDoc(flatRef),
          ]);

          enrichedSales.push({
            ...sale,
            projectName: projectSnap.exists() ? (projectSnap.data() as Project).projectName : 'N/A',
            flatNumber: flatSnap.exists() ? (flatSnap.data() as Flat).flatNumber : 'N/A',
          });
        }
        
        // 4. Calculate financials
        const totalPrice = enrichedSales.reduce((sum, s) => {
            const basePrice = s.totalPrice || 0;
            return sum + basePrice;
        }, 0);
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDue = totalPrice - totalPaid;

        setDetails({
          customer: customerData,
          sales: enrichedSales,
          payments: allPayments,
          totalPaid,
          totalPrice,
          totalDue,
        });

      } catch (e: any) {
        console.error('Failed to fetch customer details:', e);
        setError('Could not load customer data. Please try again.');
      } finally {
        setIsLoading(false);
        setIsDataDirty(false);
      }
    };

    fetchData();
  }, [customerId, firestore, isDataDirty]);

  // Derived state for filtered and paginated payments
  const filteredPayments = useMemo(() => {
    if (!details) return [];
    return details.payments.filter(p => {
        const date = new Date(p.date).toLocaleDateString();
        const searchTerm = searchQuery.toLowerCase();
        return (
            (p.paymentType || '').toLowerCase().includes(searchTerm) ||
            (p.paymentMethod || '').toLowerCase().includes(searchTerm) ||
            p.amount.toString().includes(searchTerm) ||
            date.includes(searchTerm)
        )
    });
  }, [details, searchQuery]);

  const totalPages = Math.ceil(filteredPayments.length / PAYMENTS_PER_PAGE);
  const paginatedPayments = filteredPayments.slice(
      (currentPage - 1) * PAYMENTS_PER_PAGE,
      currentPage * PAYMENTS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Action handlers for payments
  const handleEditClick = (payment: InflowTransaction) => {
    setSelectedPayment(payment);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (payment: InflowTransaction) => {
    setSelectedPayment(payment);
    setIsDeleteAlertOpen(true);
  };
  
  const confirmDeletePayment = () => {
    if (!selectedPayment) return;
    const paymentRef = doc(firestore, 'projects', selectedPayment.projectId, 'inflowTransactions', selectedPayment.id);
    deleteDocumentNonBlocking(paymentRef, () => {
        setIsDataDirty(true); // Mark data as dirty to trigger re-fetch
    });
    setIsDeleteAlertOpen(false);
    setSelectedPayment(null);
  };

  const handleViewClick = async (payment: InflowTransaction) => {
    if (!details) return;
    
    const sale = details.sales.find(s => s.flatId === payment.flatId);
    if (!sale) return;
    
    const projectSnap = await getDoc(doc(firestore, 'projects', sale.projectId));
    if (!projectSnap.exists()) return;

    const enrichedPayment: EnrichedTransaction = {
      ...payment,
      customerName: details.customer.fullName,
      projectName: sale.projectName,
      flatNumber: sale.flatNumber,
    };
    
    setSelectedPaymentForView({
        payment: enrichedPayment,
        customer: details.customer,
        project: projectSnap.data() as Project,
    });
    setIsViewDialogOpen(true);
  };

  const handlePrint = () => {
      setTimeout(() => {
            window.print();
        }, 100);
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 10000000) {
      return `৳${(value / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(value) >= 100000) {
      return `৳${(value / 100000).toFixed(2)} Lacs`;
    }
    return `৳${value.toLocaleString('en-IN')}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
            <p className="text-lg">Loading customer details...</p>
            <p className="text-sm text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8 border-2 border-dashed border-destructive rounded-lg">
             <h2 className="text-xl font-semibold text-destructive">{error}</h2>
             <p className="text-muted-foreground">There was a problem fetching the data from the server.</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
        <div className="flex justify-center items-center h-screen">
            <p>Customer not found.</p>
        </div>
    );
  }

  const { customer, sales, payments, totalPaid, totalPrice, totalDue } = details;

  return (
    <div className="space-y-6 container mx-auto py-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/customers')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          {customer.fullName}
        </h1>
        <Badge variant="secondary">Customer</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <span>{customer.fullName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span>{customer.mobile}</span>
            </div>
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5 text-muted-foreground" />
              <span>{customer.address}</span>
            </div>
            <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-muted-foreground" />
                <span>NID: {customer.nidNumber}</span>
            </div>
          </CardContent>
        </Card>
        <div className="md:col-span-2 grid gap-6">
             <Card>
                <CardHeader>
                    <CardTitle>Financials</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Paid</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                    </div>
                     <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Due</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
                    </div>
                     <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Asset Value</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalPrice)}</p>
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchased Properties</CardTitle>
          <CardDescription>
            List of all flats bought by {customer.fullName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flat Number</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Sale Date</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => {
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.flatNumber}</TableCell>
                        <TableCell>{sale.projectName}</TableCell>
                        <TableCell>{new Date(sale.saleDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sale.totalPrice)}</TableCell>
                      </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Ban className="h-12 w-12 mb-2" />
                <p className="text-lg font-semibold">No properties found.</p>
                <p className="text-sm">
                    This customer has not purchased any flats yet.
                </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>
                    Log of all payments made by {customer.fullName}.
                </CardDescription>
              </div>
              <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                      type="search" 
                      placeholder="Search payments..."
                      className="pl-8 sm:w-[300px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment, index) => {
                      const sale = sales.find(s => s.flatId === payment.flatId);
                      return (
                          <TableRow key={`${payment.id}-${index}`}>
                              <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                              <TableCell>{sale?.projectName || 'N/A'}</TableCell>
                              <TableCell>
                                  <Badge variant={payment.paymentType === 'Booking' ? 'default' : 'secondary'}>{payment.paymentType}</Badge>
                              </TableCell>
                              <TableCell>
                                  <Badge variant="outline">{payment.paymentMethod}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                  {formatCurrency(payment.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => handleViewClick(payment)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Receipt
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleEditClick(payment)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onSelect={() => handleDeleteClick(payment)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      )
                  })}
                </TableBody>
              </Table>
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
          ) : (
             <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Ban className="h-12 w-12 mb-2" />
                <p className="text-lg font-semibold">No payments found.</p>
                <p className="text-sm">
                    This customer has not made any payments yet.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this payment record.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={confirmDeletePayment}
                className="bg-destructive hover:bg-destructive/90"
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        {selectedPayment && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Payment</DialogTitle>
                        <DialogDescription>Update the details for this payment record.</DialogDescription>
                    </DialogHeader>
                    <EditPaymentForm 
                        payment={selectedPayment} 
                        setDialogOpen={setIsEditDialogOpen}
                        onUpdate={() => setIsDataDirty(true)}
                    />
                </DialogContent>
            </Dialog>
        )}

        {selectedPaymentForView && (
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-4xl p-0 no-print">
                    <ScrollArea className="max-h-[90vh]">
                        <Receipt 
                            payment={selectedPaymentForView.payment} 
                            customer={selectedPaymentForView.customer} 
                            project={selectedPaymentForView.project}
                        />
                    </ScrollArea>
                     <DialogFooter className="p-4 border-t bg-muted print:hidden">
                        <Button type="button" variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                        <Button type="button" variant="outline" onClick={handlePrint}>
                            <FileDown className="mr-2 h-4 w-4" /> Save as PDF
                        </Button>
                        <Button type="button" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}

  
