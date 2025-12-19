export type ProjectStatus = 'Planning' | 'Ongoing' | 'Completed';
export type FlatOwnership = 'Developer' | 'Landowner';
export type FlatStatus = 'Available' | 'Sold' | 'Reserved';
export type PaymentMode = 'Cash' | 'Bank';
export type TransactionType = 'Inflow' | 'Outflow';
export type InflowType = 'Booking' | 'Installment';
export type OutflowCategory = 'Material' | 'Labor' | 'Utility' | 'Office';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Accountant' | 'Viewer';
}

export interface Project {
  id: string;
  projectName: string;
  location: string;
  totalFlats: number;
  startDate: string;
  status: ProjectStatus;
}

export interface Flat {
  id: string;
  projectId: string;
  flatNumber: string;
  flatSize: number;
  ownership: FlatOwnership;
  salePrice?: number;
  status: FlatStatus;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface InflowTransaction {
  id: string;
  projectId: string;
  flatId: string;
  customerId: string;
  paymentType: InflowType;
  date: string;
  amount: number;
}

export interface OutflowTransaction {
  id: string;
  projectId?: string;
  expenseCategory: OutflowCategory;
  supplierVendor: string;
  amount: number;
  date: string;
}
