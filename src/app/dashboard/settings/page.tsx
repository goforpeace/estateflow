'use client';

import { useState, useEffect } from 'react';
import { useAuth, useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
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


export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);

  useEffect(() => {
    if (user && userDocRef) {
      const fetchUserData = async () => {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          setFirstName(userData.firstName || '');
          setLastName(userData.lastName || '');
        }
      };
      fetchUserData();
      setEmail(user.email || '');
    }
  }, [user, userDocRef]);

  const handleSaveChanges = async () => {
    if (!user || !userDocRef) return;
    setIsSaving(true);
    
    try {
      // Update display name in Firebase Auth
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`.trim(),
      });

      // Update user document in Firestore
      const userData: Partial<User> = {
        firstName,
        lastName,
      };
      
      setDocumentNonBlocking(userDocRef, userData, { merge: true });

      toast({
        title: 'Success',
        description: 'Your profile has been updated.',
      });
    } catch (error: any) {
      console.error("Error updating profile: ", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update profile. ' + error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllPayments = async () => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      const projectsQuery = collection(firestore, 'projects');
      const projectsSnap = await getDocs(projectsQuery);

      let deletedCount = 0;

      for (const projectDoc of projectsSnap.docs) {
        const inflowQuery = collection(firestore, 'projects', projectDoc.id, 'inflowTransactions');
        const inflowSnap = await getDocs(inflowQuery);
        inflowSnap.forEach(inflowDoc => {
          batch.delete(inflowDoc.ref);
          deletedCount++;
        });
      }

      await batch.commit();

      toast({
        title: 'Payments Deleted',
        description: `Successfully deleted ${deletedCount} payment records.`,
      });
    } catch (error: any) {
      console.error("Error deleting payments: ", error);
      toast({
        variant: 'destructive',
        title: 'Error Deleting Payments',
        description: 'Could not delete payment records. ' + error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };


  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
            <div>
              <h3 className="font-semibold">Delete All Payments</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all cash inflow (payment) records from every project.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete All Payments'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all payment (inflow) records across all projects in the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllPayments}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, delete all payments
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
