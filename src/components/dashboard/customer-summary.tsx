'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type CustomerSummaryData = {
  customerName: string;
  customerMobile: string;
  totalPrice: number;
  totalPaid: number;
  totalDue: number;
  lastPaymentDate: string | null;
};

export function CustomerSummary() {
  const firestore = useFirestore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CustomerSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [soldFlats, setSoldFlats] = useState<Flat[]>([]);
  
  const projectsQuery = useMemoFirebase(
    () => collection(firestore, 'projects'),
    [firestore]
  );
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  // Effect to fetch sold flats when a project is selected
  useEffect(() => {
    setSoldFlats([]);
    setSelectedFlatId(null);
    setSummary(null);
    if (!selectedProjectId) return;

    const fetchSoldFlats = async () => {
      const flatsQuery = query(collection(firestore, `projects/${selectedProjectId}/flats`), where('status', '==', 'Sold'));
      const flatsSnap = await getDocs(flatsQuery);
      setSoldFlats(flatsSnap.docs.map(d => ({...d.data(), id: d.id } as Flat)));
    };
    fetchSoldFlats();
  }, [selectedProjectId, firestore]);
  

  // Effect to fetch the full summary when a flat is selected
  useEffect(() => {
    if (!selectedFlatId || !selectedProjectId) {
      setSummary(null);
      return;
    }

    const fetchSummaryData = async () => {
      setIsLoading(true);
      try {
        // 1. Find the sale record for the flat
        const salesQuery = query(
          collection(firestore, 'sales'),
          where('projectId', '==', selectedProjectId),
          where('flatId', '==', selectedFlatId),
          limit(1)
        );
        const salesSnap = await getDocs(salesQuery);

        if (salesSnap.empty) {
          setSummary(null);
          setIsLoading(false);
          return;
        }

        const saleData = salesSnap.docs[0].data() as Sale;
        const customerId = saleData.customerId;

        // 2. Get Customer details
        const customerRef = doc(firestore, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.exists() ? customerSnap.data() as Customer : null;
        
        // 3. Get all payments for this customer for this project
        const paymentsQuery = query(
          collection(firestore, `projects/${selectedProjectId}/inflowTransactions`),
          where('customerId', '==', customerId),
          orderBy('date', 'desc')
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        
        // Filter payments specifically for the selected flat and get the most recent date overall
        const allPayments = paymentsSnap.docs.map(d => d.data() as InflowTransaction);
        const paymentsForFlat = allPayments.filter(p => p.flatId === selectedFlatId);
        
        const totalPaid = paymentsForFlat.reduce((sum, p) => sum + p.amount, 0);
        const lastPaymentDate = allPayments.length > 0 ? new Date(allPayments[0].date).toLocaleDateString() : null;

        setSummary({
          customerName: customerData?.fullName || 'N/A',
          customerMobile: customerData?.mobile || 'N/A',
          totalPrice: saleData.totalPrice,
          totalPaid: totalPaid,
          totalDue: saleData.totalPrice - totalPaid,
          lastPaymentDate: lastPaymentDate,
        });

      } catch (error) {
        console.error('Error fetching customer summary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaryData();
  }, [selectedFlatId, selectedProjectId, firestore]);
  
  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary by Customer</CardTitle>
        <CardDescription>
          Select a project and flat to see customer payment details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Select onValueChange={value => setSelectedProjectId(value)} disabled={projectsLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={value => setSelectedFlatId(value)} disabled={!selectedProjectId || soldFlats.length === 0} value={selectedFlatId || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select Flat" />
              </SelectTrigger>
              <SelectContent>
                {soldFlats.map(flat => (
                  <SelectItem key={flat.id} value={flat.id}>
                    {flat.flatNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>

        {isLoading && (
          <div className="space-y-4 pt-4">
             <Skeleton className="h-8 w-1/2" />
             <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
             </div>
          </div>
        )}

        {!isLoading && summary && (
          <div className="pt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{summary.customerName}</h3>
                <p className="text-sm text-muted-foreground">{summary.customerMobile}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-md">
                    <p className="text-muted-foreground">Total Price</p>
                    <p className="font-bold">{formatCurrency(summary.totalPrice)}</p>
                </div>
                 <div className="p-3 bg-muted rounded-md">
                    <p className="text-muted-foreground">Total Paid</p>
                    <p className="font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
                </div>
                 <div className="p-3 bg-muted rounded-md">
                    <p className="text-muted-foreground">Total Due</p>
                    <p className="font-bold text-red-600">{formatCurrency(summary.totalDue)}</p>
                </div>
                 <div className="p-3 bg-muted rounded-md">
                    <p className="text-muted-foreground">Last Payment</p>
                    <p className="font-bold">{summary.lastPaymentDate || 'N/A'}</p>
                </div>
            </div>
          </div>
        )}

        {!isLoading && selectedFlatId && !summary && (
            <div className="pt-4 text-center text-muted-foreground">
                <p>Could not load summary for this flat.</p>
            </div>
        )}

        {!selectedFlatId && (
            <div className="pt-4 text-center text-muted-foreground">
                <p>Select a project and a sold flat to view details.</p>
            </div>
        )}

      </CardContent>
    </Card>
  );
}
