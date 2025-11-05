export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  modifierIds?: string[];
  isAvailable: boolean;
}
