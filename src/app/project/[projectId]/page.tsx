'use client';

import { useState, useEffect } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
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

function StatCardSmall({title, value}: {title: string, value: string}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}


export default function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const firestore = useFirestore();
  const router = useRouter();
  const { projectId } = params;

  const [enrichedFlats, setEnrichedFlats] = useState<EnrichedFlat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const projectQuery = useMemoFirebase(
    () => (projectId ? query(collection(firestore, 'projects'), where('id', '==', projectId)) : null),
    [firestore, projectId]
  );
  const { data: projects, isLoading: projectLoading, error: projectError } = useCollection<Project>(projectQuery);
  const project = projects?.[0];

  const flatsQuery = useMemoFirebase(
    () => (projectId ? collection(firestore, 'projects', projectId, 'flats') : null),
    [firestore, projectId]
  );
  const { data: flats, isLoading: flatsLoading, error: flatsError } = useCollection<Flat>(flatsQuery);

  useEffect(() => {
    const enrichFlatData = async () => {
      setIsLoading(true);

      if (!flats) { 
        if (!flatsLoading) {
           setEnrichedFlats([]);
           setIsLoading(false);
        }
        return;
      }
      if (flats.length === 0) {
        setEnrichedFlats([]);
        setIsLoading(false);
        return;
      };


      const soldFlats = flats.filter(f => f.status === 'Sold');
      const soldFlatIds = soldFlats.map(f => f.id);

      let salesMap = new Map<string, Sale>();
      if (soldFlatIds.length > 0) {
        const salesQuery = query(
          collection(firestore, 'sales'),
          where('flatId', 'in', soldFlatIds),
          where('projectId', '==', projectId)
        );
        const salesSnap = await getDocs(salesQuery);
        salesSnap.forEach(doc => {
          const sale = doc.data() as Sale;
          salesMap.set(sale.flatId, sale);
        });
      }

      const customerIds = [...new Set(Array.from(salesMap.values()).map(s => s.customerId))];
      let customersMap = new Map<string, Customer>();
      if (customerIds.length > 0) {
        const customerPromises = [];
        for (let i = 0; i < customerIds.length; i += 30) {
            const chunk = customerIds.slice(i, i + 30);
            if(chunk.length > 0) {
                const customersQuery = query(
                    collection(firestore, 'customers'),
                    where('id', 'in', chunk)
                );
                customerPromises.push(getDocs(customersQuery));
            }
        }
        
        const customerSnapshots = await Promise.all(customerPromises);
        customerSnapshots.forEach(snap => {
            snap.forEach(doc => {
                customersMap.set(doc.id, doc.data() as Customer);
            });
        });
      }

      const enrichedData = flats.map(flat => {
        if (flat.status === 'Sold') {
          const sale = salesMap.get(flat.id);
          if (sale) {
            const customer = customersMap.get(sale.customerId);
            return {
              ...flat,
              customer: customer
                ? { fullName: customer.fullName, mobile: customer.mobile }
                : undefined,
            };
          }
        }
        return flat;
      });

      setEnrichedFlats(enrichedData.sort((a,b) => a.flatNumber.localeCompare(b.flatNumber)));
      setIsLoading(false);
    };

    enrichFlatData();
    
  }, [flats, firestore, projectId, flatsLoading]);
  
  if (projectError || flatsError) {
    console.error("Error fetching project data:", projectError || flatsError);
    return <div>Error loading project. Please try again.</div>;
  }

  if (!projectLoading && !project) {
      notFound();
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

  const soldCount = flats?.filter(f => f.status === 'Sold').length || 0;
  const availableCount = flats?.filter(f => f.status === 'Available').length || 0;
  const reservedCount = flats?.filter(f => f.status === 'Reserved').length || 0;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                {project?.projectName || 'Loading Project...'}
            </h1>
         </div>
      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>
            Details and flat status for {project?.projectName || '...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectLoading ? (
            <p>Loading project details...</p>
          ) : project ? (
            <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div><strong>Project Name:</strong> {project.projectName}</div>
                <div><strong>Location:</strong> {project.location}</div>
                <div><strong>Start Date:</strong> {new Date(project.startDate).toLocaleDateString()}</div>
                <div><strong>Status:</strong> <Badge variant={project.status === 'Ongoing' ? 'default' : 'secondary'}>{project.status}</Badge></div>
                <div><strong>Total Flats:</strong> {project.totalFlats}</div>
                <div><strong>Target Sell:</strong> {formatCurrency(project.targetSell)}</div>
            </div>
          ) : (
            <p>Project not found.</p>
          )}
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
          {isLoading ? (
            <p className="text-center p-8">Loading flat information...</p>
          ) : enrichedFlats.length > 0 ? (
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
                    <TableCell className="font-medium">{flat.flatNumber}</TableCell>
                    <TableCell>{flat.flatSize}</TableCell>
                    <TableCell>{flat.ownership}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          flat.status === 'Sold' ? 'destructive' : flat.status === 'Available' ? 'default' : 'secondary'
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
              <p className="text-lg font-semibold">No flats found for this project.</p>
              <p className="text-sm">You can add flats by editing the project.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
