// src/lib/schemas.ts

import { z } from 'zod';

export const createReservationSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  warehouseId: z.string().min(1, 'warehouseId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationIdSchema = z.object({
  id: z.string().min(1, 'reservation id is required'),
});
