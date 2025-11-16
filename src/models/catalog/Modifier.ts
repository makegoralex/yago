export interface ModifierOption {
  id: string;
  name: string;
  priceChange?: number;
  costChange?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  required: boolean;
  options: ModifierOption[];
}
