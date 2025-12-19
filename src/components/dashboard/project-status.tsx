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
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { mockProjects } from "@/lib/data"


// Simple logic to find projects with negative cash flow for demo
const projectsNeedingSupport = mockProjects.filter(p => p.status === 'Ongoing').slice(0, 2);

export function ProjectStatus() {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Net Cash Flow</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectsNeedingSupport.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="font-medium">{project.name}</div>
                  <div className="hidden text-sm text-muted-foreground md:inline">
                    {project.location}
                  </div>
                </TableCell>
                <TableCell className="text-right text-red-500">-₹1,50,000</TableCell>
                <TableCell className="text-right">
                   <Badge variant={project.status === 'Ongoing' ? 'default' : 'secondary'} className={project.status === 'Completed' ? 'bg-green-500/20 text-green-700' : 'bg-blue-500/20 text-blue-700'}>
                    {project.status}
                    </Badge>
                </TableCell>
              </TableRow>
            ))}
             <TableRow>
                <TableCell>
                  <div className="font-medium">Metropolis Tower</div>
                  <div className="hidden text-sm text-muted-foreground md:inline">
                    Financial District
                  </div>
                </TableCell>
                <TableCell className="text-right text-green-500">+₹25,30,000</TableCell>
                <TableCell className="text-right">
                   <Badge variant='secondary' className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'>
                    Completed
                    </Badge>
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
