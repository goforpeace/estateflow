'use client';

import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Receipt } from '@/components/dashboard/receipt';
import { Printer, Save, Loader2 } from 'lucide-react';
import type { EnrichedTransaction } from '@/app/dashboard/add-payment/page';
import type { Customer, Project } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface PrintReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: EnrichedTransaction;
  customer: Customer;
  project: Project;
}

export function PrintReceiptDialog({
  isOpen,
  onClose,
  payment,
  customer,
  project,
}: PrintReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handlePrint = () => {
    const node = receiptRef.current;
    if (!node) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Print Error',
        description: 'Could not open print window. Please disable your pop-up blocker.',
      });
      return;
    }

    const tailwindCssUrl = "https://cdn.tailwindcss.com";
    const receiptHtml = node.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${payment.receiptId}</title>
          <script src="${tailwindCssUrl}"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; }
            @page { 
              size: A4; 
              margin: 1.5cm;
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  const handleSavePdf = async () => {
    const node = receiptRef.current;
    if (!node) {
      toast({ variant: 'destructive', title: 'Error', description: 'Receipt content not found.' });
      return;
    }

    setIsSaving(true);

    try {
      const canvas = await html2canvas(node, {
        scale: 2, // Higher resolution capture
        useCORS: true, // Important for external images like logos
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller file size
      
      const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait, millimeters, A4
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const canvasAspectRatio = canvasWidth / canvasHeight;
      
      let finalImgWidth = pdfWidth;
      let finalImgHeight = pdfWidth / canvasAspectRatio;

      if (finalImgHeight > pdfHeight) {
          finalImgHeight = pdfHeight;
          finalImgWidth = pdfHeight * canvasAspectRatio;
      }
      
      const x = (pdfWidth - finalImgWidth) / 2;
      const y = (pdfHeight - finalImgHeight) / 2;
      
      pdf.addImage(imgData, 'JPEG', x, y, finalImgWidth, finalImgHeight);
      pdf.save(`Receipt_${payment.receiptId}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'PDF Generation Failed',
        description: 'An unexpected error occurred while creating the PDF.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            Review the receipt below. You can print it or save it as a PDF.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div ref={receiptRef}>
            <Receipt
              payment={payment}
              customer={customer}
              project={project}
            />
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 border-t bg-muted">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={handleSavePdf} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save as PDF'}
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
