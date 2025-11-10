import React from 'react';
import type { Product } from '../../store/catalog';

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product) => void;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="flex min-h-[140px] flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div>
        <p className="text-lg font-semibold text-slate-900">{product.name}</p>
        <p className="mt-2 text-sm text-slate-500">{product.modifiers?.join(', ')}</p>
      </div>
      <p className="text-xl font-bold text-slate-900">{product.price.toFixed(2)} ₽</p>
    </button>
  );
};

export default ProductCard;
