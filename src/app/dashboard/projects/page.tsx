
'use client';

import { Ban, PlusCircle, ArrowUpRight, MoreHorizontal, Search, Pencil, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
import { collection, query, doc, writeBatch, getDocs, where, limit } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { AddProjectForm } from '@/components/dashboard/projects/add-project-form';
import { EditProjectForm } from '@/components/dashboard/projects/edit-project-form';
import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 15;

export default function ProjectsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const projectsQuery = useMemoFirebase(
    () => query(collection(firestore, 'projects')),
    [firestore]
  );
  const { data: projects, isLoading } = useCollection<Project>(projectsQuery);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const openEditDialog = useCallback((project: Project) => {
    setEditingProject(project);
    setIsEditDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((projectId: string) => {
    setDeletingProjectId(projectId);
    setIsAlertOpen(true);
  }, []);
  
  const handleDeleteProject = async () => {
    if (!deletingProjectId) return;

    try {
        // Check for associated sales records
        const salesQuery = query(
            collection(firestore, 'sales'),
            where('projectId', '==', deletingProjectId),
            limit(1)
        );
        const salesSnapshot = await getDocs(salesQuery);

        if (!salesSnapshot.empty) {
            toast({
                variant: "destructive",
                title: "Cannot Delete Project",
                description: "This project has associated sales records. Please delete the sales first.",
            });
            return;
        }

        const batch = writeBatch(firestore);

        // Reference to the main project document
        const projectRef = doc(firestore, 'projects', deletingProjectId);

        // Delete all subcollections first
        const subcollections = ['flats', 'inflowTransactions', 'outflowTransactions', 'officeCostAllocations'];
        for (const sub of subcollections) {
            const subcollectionRef = collection(firestore, 'projects', deletingProjectId, sub);
            const snapshot = await getDocs(subcollectionRef);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
        }

        // Finally, delete the project document itself
        batch.delete(projectRef);

        await batch.commit();

        toast({
            title: "Project Deleted",
            description: "The project and all its associated data have been deleted.",
        });
    } catch (error: any) {
        console.error("Error deleting project:", error);
        toast({
            variant: "destructive",
            title: "Error Deleting Project",
            description: error.message,
        });
    } finally {
        setIsAlertOpen(false);
        setDeletingProjectId(null);
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

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const searchTerm = searchQuery.toLowerCase();
    return projects.filter(project =>
        project.projectName.toLowerCase().includes(searchTerm) ||
        project.location.toLowerCase().includes(searchTerm) ||
        project.status.toLowerCase().includes(searchTerm)
    );
  }, [projects, searchQuery]);

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = filteredProjects.slice(
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
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                Manage all your real estate projects.
              </CardDescription>
            </div>
             <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
                 <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search projects..."
                        className="pl-8 sm:w-full lg:w-[300px]"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Project
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                    <DialogTitle>Add New Project</DialogTitle>
                    </DialogHeader>
                    <AddProjectForm setDialogOpen={setIsAddDialogOpen} />
                </DialogContent>
                </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading projects...</p>
            </div>
          )}
          {!isLoading && !paginatedProjects?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No projects found.</p>
              <p className="text-sm">
                 {searchQuery ? 'Try a different search term or' : 'Click "Add Project" to'} get started.
              </p>
            </div>
          )}
          {!isLoading && paginatedProjects && paginatedProjects.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Target Sell</TableHead>
                      <TableHead>Total Flats</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProjects.map(project => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          {project.projectName}
                        </TableCell>
                        <TableCell>{project.location}</TableCell>
                        <TableCell>{formatCurrency(project.targetSell)}</TableCell>
                        <TableCell>{project.totalFlats}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              project.status === 'Ongoing' ? 'default' : 'secondary'
                            }
                            className={
                              project.status === 'Completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                                : project.status === 'Ongoing'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400'
                            }
                          >
                            {project.status}
                          </Badge>
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
                              <DropdownMenuItem asChild>
                                  <Link href={`/project/${project.id}`}>View Details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openEditDialog(project)}>
                                  Edit Project
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onSelect={() => openDeleteDialog(project.id)}>Delete Project</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
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

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete this project and all its associated data (flats, transactions, etc.). This action cannot be undone.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={handleDeleteProject}
                className="bg-destructive hover:bg-destructive/90"
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingProject && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            <EditProjectForm project={editingProject} setDialogOpen={setIsEditDialogOpen} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
