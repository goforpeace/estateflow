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
import type { Project, Flat, Sale, Customer } from '@/lib/types';
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
import { Building, Phone, User as UserIcon, ArrowLeft } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type EnrichedFlat = Flat & {
  customer?: {
    fullName: string;
    mobile: string;
  };
};

function StatCardSmall({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const firestore = useFirestore();
  const router = useRouter();
  const { projectId } = params;

  const [project, setProject] = useState<Project | null>(null);
  const [enrichedFlats, setEnrichedFlats] = useState<EnrichedFlat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch Project Details
        const projectRef = doc(firestore, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          notFound();
          return;
        }
        const projectData = projectSnap.data() as Project;
        setProject(projectData);

        // 2. Fetch all related data concurrently
        const flatsQuery = query(collection(firestore, `projects/${projectId}/flats`));
        const salesQuery = query(collection(firestore, 'sales'), where('projectId', '==', projectId));

        const [flatsSnap, salesSnap] = await Promise.all([
          getDocs(flatsQuery),
          getDocs(salesQuery),
        ]);
        
        const flats = flatsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Flat));
        const sales = salesSnap.docs.map(d => d.data() as Sale);
        
        const customersMap = new Map<string, Customer>();
        const flatToCustomerMap = new Map<string, string>();
        
        // 3. Build maps and collect unique customer IDs from sales
        if (sales.length > 0) {
            const customerIds = [...new Set(sales.map(s => s.customerId))];
            sales.forEach(sale => flatToCustomerMap.set(sale.flatId, sale.customerId));

            // 4. Fetch all customers associated with the sales
            if (customerIds.length > 0) {
                const customerChunks = [];
                for (let i = 0; i < customerIds.length; i += 30) {
                  customerChunks.push(customerIds.slice(i, i + 30));
                }
                
                const customerPromises = customerChunks.map(chunk => 
                    getDocs(query(collection(firestore, 'customers'), where('id', 'in', chunk)))
                );
      
                const customerSnapshots = await Promise.all(customerPromises);
                customerSnapshots.forEach(snap => {
                    snap.forEach(doc => {
                        customersMap.set(doc.id, doc.data() as Customer);
                    });
                });
            }
        }
        
        // 5. Enrich the flat data with customer info
        const enrichedData = flats.map(flat => {
          const customerId = flatToCustomerMap.get(flat.id);
          const customer = customerId ? customersMap.get(customerId) : undefined;
          return {
            ...flat,
            customer: customer ? { fullName: customer.fullName, mobile: customer.mobile } : undefined,
          };
        });

        setEnrichedFlats(enrichedData.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true })));

      } catch (e: any) {
        console.error('Failed to fetch project details:', e);
        setError('Could not load project data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, firestore]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading project details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  
  if (!project) {
    notFound();
    return null;
  }

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

  const soldCount = enrichedFlats.filter(f => f.status === 'Sold').length;
  const availableCount = enrichedFlats.filter(
    f => f.status === 'Available'
  ).length;
  const reservedCount = enrichedFlats.filter(
    f => f.status === 'Reserved'
  ).length;

  return (
    <div className="space-y-6 container mx-auto py-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          {project.projectName}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>
            Details and flat status for {project.projectName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <strong>Project Name:</strong> {project.projectName}
            </div>
            <div>
              <strong>Location:</strong> {project.location}
            </div>
            <div>
              <strong>Start Date:</strong>{' '}
              {new Date(project.startDate).toLocaleDateString()}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <Badge
                variant={project.status === 'Ongoing' ? 'default' : 'secondary'}
              >
                {project.status}
              </Badge>
            </div>
            <div>
              <strong>Total Flats:</strong> {project.totalFlats}
            </div>
            <div>
              <strong>Target Sell:</strong> {formatCurrency(project.targetSell)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCardSmall title="Sold" value={soldCount.toString()} />
        <StatCardSmall title="Available" value={availableCount.toString()} />
        <StatCardSmall title="Reserved" value={reservedCount.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flats</CardTitle>
          <CardDescription>List of all flats in this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {enrichedFlats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flat Number</TableHead>
                  <TableHead>Size (SFT)</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedFlats.map(flat => (
                  <TableRow key={flat.id}>
                    <TableCell className="font-medium">
                      {flat.flatNumber}
                    </TableCell>
                    <TableCell>{flat.flatSize}</TableCell>
                    <TableCell>{flat.ownership}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          flat.status === 'Sold'
                            ? 'destructive'
                            : flat.status === 'Available'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {flat.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {flat.customer ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{flat.customer.fullName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{flat.customer.mobile}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Building className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">
                No flats found for this project.
              </p>
              <p className="text-sm">
                You can add flats by editing the project.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
