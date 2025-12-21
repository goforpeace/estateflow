'use client';

import React from 'react';
import { EnrichedOutflow } from '@/app/dashboard/make-payment/page';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OutflowDetailsProps {
  payment: EnrichedOutflow;
}

export const OutflowDetails: React.FC<OutflowDetailsProps> = ({ payment }) => {
  const formatCurrency = (value: number) => `৳${value.toLocaleString('en-IN')}`;

  return (
    <ScrollArea className="max-h-[60vh] pr-6">
      <div className="space-y-4 text-sm">
        <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Vendor</p>
          <p>{payment.supplierVendor}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Project</p>
          <p>{payment.projectName}</p>
        </div>
         <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Expense ID</p>
          <p className="font-mono">{payment.expenseId || 'N/A'}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Date</p>
          <p>{new Date(payment.date).toLocaleDateString()}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Amount</p>
          <p className="font-bold">{formatCurrency(payment.amount)}</p>
        </div>
         <div className="flex justify-between items-center pb-2 border-b">
          <p className="font-semibold text-primary">Payment Method</p>
          <p>{payment.paymentMethod}</p>
        </div>
        {payment.reference && (
          <div className="flex justify-between items-center pb-2 border-b">
            <p className="font-semibold text-primary">Reference</p>
            <p>{payment.reference}</p>
          </div>
        )}
        {payment.description && (
          <div className="space-y-1 pt-2">
            <p className="font-semibold text-primary">Description</p>
            <p className="text-muted-foreground bg-slate-50 p-3 rounded-md">{payment.description}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

    