export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  modifierGroups?: string[];
  isAvailable: boolean;
}
