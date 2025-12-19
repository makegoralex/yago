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
      className="group flex min-h-[130px] flex-col justify-between rounded-xl bg-white p-2.5 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-[150px] sm:p-3 lg:min-h-[165px]"
    >
      <div className="flex flex-col gap-2">
        {product.imageUrl ? (
          <div className="flex h-16 items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:h-20 lg:h-24">
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">{product.name}</p>
          {product.description ? (
            <p className="mt-1 h-8 overflow-hidden text-xs text-slate-500 text-ellipsis sm:h-10">
              {product.description}
            </p>
          ) : null}
          {product.modifierGroups?.length ? (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
              {product.modifierGroups.map((group) => group.name).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-base font-bold text-slate-900 sm:text-lg">{product.price.toFixed(2)} ₽</p>
        {hasDiscount ? (
          <span className="text-xs font-medium text-slate-400 line-through">
            {product.basePrice?.toFixed(2)} ₽
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default ProductCard;
