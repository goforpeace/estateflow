import type { User, Project, Flat, Customer, Transaction } from './types';

export const mockUser: User = {
  id: 'user-1',
  name: 'Admin User',
  email: 'admin@estateflow.com',
  avatarUrl: 'https://picsum.photos/seed/user1/100/100',
  role: 'Admin',
};

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Azure Heights',
    location: 'Downtown, Metro City',
    totalFlats: 100,
    developerShare: 60,
    landownerShare: 40,
    startDate: '2023-01-15',
    status: 'Ongoing',
  },
  {
    id: 'proj-2',
    name: 'Serene Gardens',
    location: 'Suburbia, Green Valley',
    totalFlats: 50,
    developerShare: 50,
    landownerShare: 50,
    startDate: '2023-06-20',
    status: 'Planning',
  },
  {
    id: 'proj-3',
    name: 'Metropolis Tower',
    location: 'Financial District',
    totalFlats: 200,
    developerShare: 70,
    landownerShare: 30,
    startDate: '2022-03-10',
    status: 'Completed',
  },
];

export const mockCustomers: Customer[] = [
  { id: 'cust-1', name: 'John Doe', phone: '555-1234' },
  { id: 'cust-2', name: 'Jane Smith', phone: '555-5678' },
];

export const mockFlats: Flat[] = [
  // Azure Heights
  { id: 'flat-101', projectId: 'proj-1', flatNumber: 'A-101', ownership: 'Developer', salePrice: 5000000, status: 'Sold', customerId: 'cust-1' },
  { id: 'flat-102', projectId: 'proj-1', flatNumber: 'A-102', ownership: 'Developer', salePrice: 5200000, status: 'Available' },
  { id: 'flat-103', projectId: 'proj-1', flatNumber: 'A-103', ownership: 'Landowner', salePrice: null, status: 'Reserved' },
  // Serene Gardens
  { id: 'flat-201', projectId: 'proj-2', flatNumber: 'B-1', ownership: 'Developer', salePrice: 7500000, status: 'Available' },
  { id: 'flat-202', projectId: 'proj-2', flatNumber: 'B-2', ownership: 'Landowner', salePrice: null, status: 'Available' },
];

export const mockTransactions: Transaction[] = [
  // Inflows
  { id: 'txn-1', projectId: 'proj-1', type: 'Inflow', category: 'Booking', date: '2023-02-01', amount: 500000, flatId: 'flat-101', customerId: 'cust-1' },
  { id: 'txn-2', projectId: 'proj-1', type: 'Inflow', category: 'Installment', date: '2023-03-01', amount: 100000, flatId: 'flat-101', customerId: 'cust-1' },
  { id: 'txn-3', projectId: 'proj-1', type: 'Inflow', category: 'Installment', date: '2023-04-01', amount: 100000, flatId: 'flat-101', customerId: 'cust-1' },
  // Outflows
  { id: 'txn-4', projectId: 'proj-1', type: 'Outflow', category: 'Material', date: '2023-02-15', amount: 1200000 },
  { id: 'txn-5', projectId: 'proj-1', type: 'Outflow', category: 'Labor', date: '2023-03-20', amount: 300000 },
  { id: 'txn-6', projectId: 'proj-3', type: 'Outflow', category: 'Utility', date: '2023-04-05', amount: 50000 },
  { id: 'txn-7', projectId: 'proj-1', type: 'Outflow', category: 'Material', date: '2023-04-10', amount: 750000 },
  { id: 'txn-8', projectId: 'proj-1', type: 'Inflow', category: 'Installment', date: '2024-05-01', amount: 100000, flatId: 'flat-101', customerId: 'cust-1' },
  { id: 'txn-9', projectId: 'proj-1', type: 'Inflow', category: 'Installment', date: '2024-06-01', amount: 150000, flatId: 'flat-101', customerId: 'cust-1' },
  { id: 'txn-10', projectId: 'proj-1', type: 'Outflow', category: 'Material', date: '2024-06-15', amount: 200000 },
];
