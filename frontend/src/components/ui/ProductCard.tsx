import React from 'react';
import type { Product } from '../../store/catalog';

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product) => void;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const hasDiscount = product.basePrice && product.basePrice > product.price;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="flex min-h-[180px] flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex flex-col gap-3">
        {product.imageUrl ? (
          <div className="flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div>
          <p className="text-lg font-semibold text-slate-900">{product.name}</p>
          {product.description ? (
            <p className="mt-1 h-10 overflow-hidden text-sm text-slate-500 text-ellipsis">
              {product.description}
            </p>
          ) : null}
          {product.modifiers?.length ? (
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {product.modifiers.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-xl font-bold text-slate-900">{product.price.toFixed(2)} ₽</p>
        {hasDiscount ? (
          <span className="text-sm font-medium text-slate-400 line-through">
            {product.basePrice?.toFixed(2)} ₽
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default ProductCard;
