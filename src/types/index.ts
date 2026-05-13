// src/types/index.ts

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

export interface ProductWithStock extends Product {
  stock: StockEntry[];
}

export interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface ApiError {
  error: string;
  code?: string;
}
