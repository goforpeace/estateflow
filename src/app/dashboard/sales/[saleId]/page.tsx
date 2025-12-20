
'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
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
  FileText,
  Building,
  Hash,
  DollarSign,
  CalendarIcon,
  ParkingCircle,
  Wrench,
  StickyNote,
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type SaleDetails = {
  sale: Sale;
  project: Project;
  flat: Flat;
  customer: Customer;
};

export default function SaleDetailPage({
  params,
}: {
  params: { saleId: string };
}) {
  const firestore = useFirestore();
  const router = useRouter();
  const { saleId } = params;

  const [details, setDetails] = useState<SaleDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saleId || !firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch the sale document
        const saleRef = doc(firestore, 'sales', saleId);
        const saleSnap = await getDoc(saleRef);

        if (!saleSnap.exists()) {
          notFound();
          return;
        }

        const saleData = saleSnap.data() as Sale;

        // 2. Fetch related project, flat, and customer concurrently
        const projectRef = doc(firestore, 'projects', saleData.projectId);
        const flatRef = doc(firestore, 'projects', saleData.projectId, 'flats', saleData.flatId);
        const customerRef = doc(firestore, 'customers', saleData.customerId);
        
        const [projectSnap, flatSnap, customerSnap] = await Promise.all([
            getDoc(projectRef),
            getDoc(flatRef),
            getDoc(customerRef)
        ]);

        if (!projectSnap.exists() || !flatSnap.exists() || !customerSnap.exists()) {
            throw new Error("Related data for the sale is missing.");
        }
        
        setDetails({
            sale: saleData,
            project: projectSnap.data() as Project,
            flat: flatSnap.data() as Flat,
            customer: customerSnap.data() as Customer,
        });

      } catch (e: any) {
        console.error('Failed to fetch sale details:', e);
        setError('Could not load sale data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [saleId, firestore]);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return `৳${value.toLocaleString('en-IN')}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
            <p className="text-lg">Loading sale details...</p>
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
            <p>Sale not found.</p>
        </div>
    );
  }

  const { sale, project, flat, customer } = details;

  const basePrice = sale.totalPrice - (sale.parkingCharge || 0) - (sale.utilityCharge || 0) - (sale.extraCosts?.reduce((acc, cost) => acc + cost.amount, 0) || 0)

  return (
    <div className="space-y-6 container mx-auto py-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/sales')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Sale Details
        </h1>
        <Badge variant="secondary">ID: {sale.id.substring(0, 6)}...</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
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
              <Landmark className="h-5 w-5 text-muted-foreground" />
              <span>NID: {customer.nidNumber}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <span>Project: {project.projectName}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <span>Flat: {flat.flatNumber} ({flat.flatSize} sft)</span>
                </div>
                 {sale.deedLink && (
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <a href={sale.deedLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">View Deed</a>
                    </div>
                 )}
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
          <CardDescription>
            Breakdown of the sale price and payment plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col space-y-1.5 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Base Price</p>
                    <p className="text-lg font-bold">{formatCurrency(basePrice)}</p>
                </div>
                <div className="flex flex-col space-y-1.5 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><ParkingCircle className="h-4 w-4" /> Parking Charge</p>
                    <p className="text-lg font-bold">{formatCurrency(sale.parkingCharge)}</p>
                </div>
                 <div className="flex flex-col space-y-1.5 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Wrench className="h-4 w-4" /> Utility Charge</p>
                    <p className="text-lg font-bold">{formatCurrency(sale.utilityCharge)}</p>
                </div>
                 <div className="flex flex-col space-y-1.5 p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-primary/80 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Price</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(sale.totalPrice)}</p>
                </div>
            </div>

            {sale.extraCosts && sale.extraCosts.length > 0 && (
                <div>
                    <h4 className="font-medium mb-2">Extra Costs</h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Purpose</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sale.extraCosts.map((cost, index) => (
                                <TableRow key={index}>
                                    <TableCell>{cost.purpose}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(cost.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
             <div>
                <h4 className="font-medium mb-2">Payment Plan</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><strong>Downpayment:</strong> {formatCurrency(sale.downpayment)}</p>
                    <p><strong>Monthly Installment:</strong> {formatCurrency(sale.monthlyInstallment)}</p>
                </div>
            </div>
            {sale.note && (
                <div>
                     <h4 className="font-medium mb-2 flex items-center gap-2"><StickyNote className="h-4 w-4" /> Note</h4>
                    <p className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">{sale.note}</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
