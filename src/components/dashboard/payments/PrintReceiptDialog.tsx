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
    if (!receiptRef.current) return;
    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Receipt</title>');
      printWindow.document.write(`
        <style>
          @media print { 
            @page { size: A4; margin: 1.5cm; } 
          } 
          body { 
            font-family: Inter, sans-serif; 
          }
          .text-gray-800 { color: #1f2937; }
          .font-sans { font-family: Inter, sans-serif; }
          .p-4 { padding: 1rem; }
          .bg-white { background-color: #ffffff; }
          .max-w-4xl { max-width: 56rem; }
          .mx-auto { margin-left: auto; margin-right: auto; }
          .min-h-screen { min-height: 100vh; }
          .flex { display: flex; }
          .flex-col { flex-direction: column; }
          .justify-between { justify-content: space-between; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .items-end { align-items: flex-end; }
          .pb-6 { padding-bottom: 1.5rem; }
          .mb-8 { margin-bottom: 2rem; }
          .border-b-2 { border-bottom-width: 2px; }
          .border-primary { border-color: hsl(222.2, 47.4%, 11.2%); }
          .w-32 { width: 8rem; }
          .text-right { text-align: right; }
          .text-3xl { font-size: 1.875rem; }
          .font-bold { font-weight: 700; }
          .text-primary { color: hsl(222.2, 47.4%, 11.2%); }
          .text-sm { font-size: 0.875rem; }
          .text-gray-500 { color: #6b7280; }
          .flex-grow { flex-grow: 1; }
          .mb-10 { margin-bottom: 2.5rem; }
          .w-1/2 { width: 50%; }
          .text-2xl { font-size: 1.5rem; }
          .font-semibold { font-weight: 600; }
          .text-gray-700 { color: #374151; }
          .uppercase { text-transform: uppercase; }
          .tracking-widest { letter-spacing: 0.1em; }
          .bg-gray-100 { background-color: #f3f4f6; }
          .px-4 { padding-left: 1rem; padding-right: 1rem; }
          .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          .inline-block { display: inline-block; }
          .w-28 { width: 7rem; }
          .text-left { text-align: left; }
          .font-mono { font-family: monospace; }
          .mt-1 { margin-top: 0.25rem; }
          .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.25rem; }
          .leading-relaxed { line-height: 1.625; }
          .items-baseline { align-items: baseline; }
          .w-48 { width: 12rem; }
          .shrink-0 { flex-shrink: 0; }
          .border-b { border-bottom-width: 1px; }
          .border-dotted { border-style: dotted; }
          .border-gray-400 { border-color: #9ca3af; }
          .pb-1 { padding-bottom: 0.25rem; }
          .font-medium { font-weight: 500; }
          .capitalize { text-transform: capitalize; }
          .my-12 { margin-top: 3rem; margin-bottom: 3rem; }
          .justify-start { justify-content: flex-start; }
          .border { border-width: 1px; }
          .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
          .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
          .rounded-lg { border-radius: 0.5rem; }
          .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
          .justify-center { justify-content: center; }
          .text-lg { font-size: 1.125rem; }
          .mt-auto { margin-top: auto; }
          .pt-8 { padding-top: 2rem; }
          .text-center { text-align: center; }
          .w-1/3 { width: 33.333333%; }
          .pt-2 { padding-top: 0.5rem; }
          .mt-12 { margin-top: 3rem; }
          .border-t { border-top-width: 1px; }
          .text-xs { font-size: 0.75rem; }
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
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
        scale: 2, 
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
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
