'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CustomerReport } from '@/components/reports/customer-report';
import { SalesReport } from '@/components/reports/sales-report';
import { PaymentLogReport } from '@/components/reports/payment-log-report';
import { VendorReport } from '@/components/reports/vendor-report';
import { ExpenseReport } from '@/components/reports/expense-report';
import { VendorPaymentReport } from '@/components/reports/vendor-payment-report';

export default function ExportReportsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
          <CardDescription>
            Generate and download detailed CSV reports for your business data.
            Select a report type and apply filters to get the data you need.
          </CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="payments">Payment Logs</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="vendor-payments">Vendor Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <CustomerReport />
        </TabsContent>
        <TabsContent value="sales">
          <SalesReport />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentLogReport />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorReport />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpenseReport />
        </TabsContent>
        <TabsContent value="vendor-payments">
          <VendorPaymentReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
