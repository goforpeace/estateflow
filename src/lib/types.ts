export type ProjectStatus = 'Planning' | 'Ongoing' | 'Completed';
export type FlatOwnership = 'Developer' | 'Landowner';
export type FlatStatus = 'Available' | 'Sold' | 'Reserved';
export type PaymentMode = 'Cash' | 'Bank';
export type TransactionType = 'Inflow' | 'Outflow';
export type InflowType = 'Booking' | 'Installment';
export type OutflowCategory = 'Material' | 'Labor' | 'Utility' | 'Office';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Admin' | 'Accountant' | 'Viewer';
};

export type Project = {
  id: string;
  name: string;
  location: string;
  totalFlats: number;
  developerShare: number;
  landownerShare: number;
  startDate: string;
  status: ProjectStatus;
};

export type Flat = {
  id: string;
  projectId: string;
  flatNumber: string;
  ownership: FlatOwnership;
  salePrice: number | null;
  status: FlatStatus;
  customerId?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
};

export type Transaction = {
  id: string;
  projectId: string;
  type: TransactionType;
  category: InflowType | OutflowCategory;
  date: string;
  amount: number;
  flatId?: string;
  customerId?: string;
};
