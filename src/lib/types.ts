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
  targetSell: number;
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
  fullName: string;
  mobile: string;
  address: string;
  nidNumber: string;
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

export interface Sale {
  id: string;
  projectId: string;
  flatId: string;
  customerId: string;
  totalPrice: number;
  perSftPrice?: number;
  parkingCharge?: number;
  utilityCharge?: number;
  downpayment?: number;
  monthlyInstallment?: number;
  saleDate: string;
  note?: string;
  deedLink?: string;
}
