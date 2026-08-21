import React from 'react';
import type { Product } from '../../store/catalog';
import { getPricingUnit } from '../../lib/productUnit';

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
      title={product.name}
      className="group flex h-[170px] min-h-0 flex-col overflow-hidden rounded-xl bg-white p-2 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-[190px] sm:p-2.5 lg:h-[210px]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {product.imageUrl ? (
          <div className="flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:h-16 lg:h-20">
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
          </div>
        ) : null}
        <div className="min-h-0 overflow-hidden">
          <p className="overflow-hidden break-words text-sm font-semibold leading-snug text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
            {product.name}
          </p>
          {product.description ? (
            <p className="mt-1 overflow-hidden text-[11px] text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {product.description}
            </p>
          ) : null}
          {product.modifierGroups?.length ? (
            <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-slate-400">
              {product.modifierGroups.map((group) => group.name).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex shrink-0 items-baseline gap-2">
        <p className="whitespace-nowrap text-sm font-normal text-slate-900 sm:text-base">
          {product.price.toFixed(2)} ₽ / {getPricingUnit(product.unit)}
        </p>
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
