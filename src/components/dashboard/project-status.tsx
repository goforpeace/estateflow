'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, Ban } from "lucide-react"
import Link from "next/link"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, limit, query, where } from "firebase/firestore"
import type { Project } from "@/lib/types"


export function ProjectStatus() {
  const firestore = useFirestore();
  const projectsQuery = useMemoFirebase(() => query(collection(firestore, "projects"), limit(3)), [firestore]);
  const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
            <CardTitle>Projects</CardTitle>
            <CardDescription>
                Overview of project financial health.
            </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
            <Link href="/dashboard/projects">
            View All
            <ArrowUpRight className="h-4 w-4" />
            </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center h-40">
            <p>Loading projects...</p>
          </div>
        )}
        {!isLoading && !projects?.length && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                <Ban className="h-10 w-10 mb-2" />
                <p>No projects found.</p>
                <p className="text-sm">Add a new project to get started.</p>
            </div>
        )}
        {!isLoading && projects && projects.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="font-medium">{project.projectName}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {project.location}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={project.status === 'Ongoing' ? 'default' : 'secondary'} 
                      className={
                        project.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                        project.status === 'Ongoing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400'
                      }>
                      {project.status}
                      </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
