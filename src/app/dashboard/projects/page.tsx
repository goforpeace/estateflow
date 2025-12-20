
'use client';

import { Ban, PlusCircle, Pencil, ArrowUpRight, Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { AddProjectForm } from '@/components/dashboard/projects/add-project-form';
import { EditProjectForm } from '@/components/dashboard/projects/edit-project-form';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteProject = async (projectId: string) => {
    try {
        const batch = writeBatch(firestore);

        // Reference to the main project document
        const projectRef = doc(firestore, 'projects', projectId);

        // Delete all subcollections first
        const subcollections = ['flats', 'inflowTransactions', 'outflowTransactions', 'officeCostAllocations'];
        for (const sub of subcollections) {
            const subcollectionRef = collection(firestore, 'projects', projectId, sub);
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
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                Manage all your real estate projects.
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
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
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-60">
              <p>Loading projects...</p>
            </div>
          )}
          {!isLoading && !projects?.length && (
            <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Ban className="h-12 w-12 mb-2" />
              <p className="text-lg font-semibold">No projects found.</p>
              <p className="text-sm">
                Click &quot;Add Project&quot; to get started.
              </p>
            </div>
          )}
          {!isLoading && projects && projects.length > 0 && (
            <TooltipProvider>
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
                  {projects.map(project => (
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
                      <TableCell className="text-right space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" asChild>
                              <Link href={`/project/${project.id}`}>
                                  <ArrowUpRight className="h-4 w-4" />
                                  <span className="sr-only">View Project</span>
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Project</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => handleEditClick(project)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit Project</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Project</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Project</span>
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete Project</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete this project and all its associated data (flats, transactions, etc.).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProject(project.id)}
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
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
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

    