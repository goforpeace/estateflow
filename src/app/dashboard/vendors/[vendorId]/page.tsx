
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
  collectionGroup,
} from 'firebase/firestore';
import type {
  Vendor,
  Expense,
  OutflowTransaction,
  Project,
  ExpenseItem,
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
  Building,
  Briefcase,
  Ban,
  Search,
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type EnrichedExpense = Expense & {
    projectName: string;
    itemName: string;
}

type EnrichedOutflow = OutflowTransaction & {
    projectName: string;
}

type VendorDetails = {
  vendor: Vendor;
  expenses: EnrichedExpense[];
  payments: EnrichedOutflow[];
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
};

const ITEMS_PER_PAGE = 5;

export default function VendorDetailPage({
  params,
}: {
  params: { vendorId: string };
}) {
  const firestore = useFirestore();
  const router = useRouter();
  const { vendorId } = params;

  const [details, setDetails] = useState<VendorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [expenseSearch, setExpenseSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);


  useEffect(() => {
    if (!vendorId || !firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all required data concurrently
        const vendorRef = doc(firestore, 'vendors', vendorId);
        const projectsQuery = collection(firestore, 'projects');
        const itemsQuery = collection(firestore, 'expenseItems');
        const allOutflowsQuery = collectionGroup(firestore, 'outflowTransactions');
        
        const [vendorSnap, projectsSnap, itemsSnap, allOutflowsSnap] = await Promise.all([
            getDoc(vendorRef),
            getDocs(projectsQuery),
            getDocs(itemsQuery),
            getDocs(allOutflowsQuery)
        ]);

        if (!vendorSnap.exists()) {
          notFound();
          return;
        }

        const vendorData = vendorSnap.data() as Vendor;
        const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data() as Project]));
        const itemsMap = new Map(itemsSnap.docs.map(d => [d.id, d.data() as ExpenseItem]));

        // Fetch expenses for this vendor
        const expensesQuery = query(
          collection(firestore, 'expenses'),
          where('vendorId', '==', vendorId)
        );
        const expensesSnap = await getDocs(expensesQuery);
        const vendorExpenses = expensesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
        
        const enrichedExpenses = vendorExpenses.map(exp => ({
            ...exp,
            projectName: projectsMap.get(exp.projectId)?.projectName || 'N/A',
            itemName: itemsMap.get(exp.itemId)?.name || 'N/A',
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Filter all outflows for the current vendor on the client
        const vendorPayments = allOutflowsSnap.docs
            .map(d => ({ ...d.data(), id: d.id } as OutflowTransaction))
            .filter(o => o.supplierVendor === vendorData.vendorName);

        const enrichedPayments = vendorPayments.map(p => ({
            ...p,
            projectName: p.projectId ? projectsMap.get(p.projectId)?.projectName || 'Office' : 'Office',
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Calculate financials
        const totalBilled = vendorExpenses.reduce((sum, e) => sum + e.price, 0);
        const totalPaid = vendorPayments.reduce((sum, p) => sum + p.amount, 0);

        setDetails({
          vendor: vendorData,
          expenses: enrichedExpenses,
          payments: enrichedPayments,
          totalBilled,
          totalPaid,
          totalDue: totalBilled - totalPaid,
        });

      } catch (e: any) {
        console.error('Failed to fetch vendor details:', e);
        setError('Could not load vendor data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [vendorId, firestore]);
  
  const filteredExpenses = useMemo(() => {
    if (!details) return [];
    return details.expenses.filter(e => 
        e.projectName.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        e.itemName.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        e.expenseId.toLowerCase().includes(expenseSearch.toLowerCase())
    )
  }, [details, expenseSearch]);

  const filteredPayments = useMemo(() => {
    if (!details) return [];
    return details.payments.filter(p =>
        p.projectName.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        (p.expenseId || '').toLowerCase().includes(paymentSearch.toLowerCase()) ||
        p.amount.toString().includes(paymentSearch)
    )
  }, [details, paymentSearch]);

  const paginatedExpenses = filteredExpenses.slice((expensePage - 1) * ITEMS_PER_PAGE, expensePage * ITEMS_PER_PAGE);
  const totalExpensePages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);

  const paginatedPayments = filteredPayments.slice((paymentPage - 1) * ITEMS_PER_PAGE, paymentPage * ITEMS_PER_PAGE);
  const totalPaymentPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);


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
            <p className="text-lg">Loading vendor details...</p>
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
            <p>Vendor not found.</p>
        </div>
    );
  }

  const { vendor, expenses, payments, totalBilled, totalPaid, totalDue } = details;

  return (
    <div className="space-y-6 container mx-auto py-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/vendors')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          {vendor.vendorName}
        </h1>
        <Badge variant="secondary">Vendor</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <span>{vendor.enterpriseName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span>{vendor.phoneNumber}</span>
            </div>
            {vendor.details && (
                <div className="flex items-start gap-3 pt-2">
                    <span className="text-muted-foreground font-semibold">Details:</span>
                    <p className="text-muted-foreground flex-1">{vendor.details}</p>
                </div>
            )}
          </CardContent>
        </Card>
        <div className="md:col-span-2 grid gap-6">
             <Card>
                <CardHeader>
                    <CardTitle>Financials</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Bill</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalBilled)}</p>
                    </div>
                     <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Paid</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                    </div>
                     <div className="flex flex-col space-y-1.5">
                        <p className="text-sm text-muted-foreground">Total Due</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <CardTitle>Expense Log</CardTitle>
                    <CardDescription>All bills received from this vendor.</CardDescription>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search expenses..."
                        className="pl-8 sm:w-[300px]"
                        value={expenseSearch}
                        onChange={(e) => setExpenseSearch(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {paginatedExpenses.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map(expense => (
                    <TableRow key={expense.id}>
                        <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                        <TableCell>{expense.projectName}</TableCell>
                        <TableCell>{expense.itemName}</TableCell>
                        <TableCell>
                             <Badge variant={
                                expense.status === 'Paid' ? 'default' :
                                expense.status === 'Partially Paid' ? 'secondary' : 'destructive'
                            }>
                                {expense.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(expense.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Page {expensePage} of {totalExpensePages}
                </div>
                <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.max(1, p - 1))} disabled={expensePage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.min(totalExpensePages, p + 1))} disabled={expensePage === totalExpensePages}>Next</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Ban className="h-12 w-12 mb-2" />
                <p className="text-lg font-semibold">No expenses found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Log of all payments made to this vendor.</CardDescription>
              </div>
              <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                      type="search" 
                      placeholder="Search payments..."
                      className="pl-8 sm:w-[300px]"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                  />
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedPayments.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Expense ID</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map(payment => (
                      <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                          <TableCell>{payment.projectName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">{payment.expenseId || 'N/A'}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(payment.amount)}
                          </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Page {paymentPage} of {totalPaymentPages}
                </div>
                 <Button variant="outline" size="sm" onClick={() => setPaymentPage(p => Math.max(1, p - 1))} disabled={paymentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPaymentPage(p => Math.min(totalPaymentPages, p + 1))} disabled={paymentPage === totalPaymentPages}>Next</Button>
              </div>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Ban className="h-12 w-12 mb-2" />
                <p className="text-lg font-semibold">No payments found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
