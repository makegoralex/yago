import React from 'react';
import type { Category } from '../../store/catalog';

export type CategorySidebarProps = {
  categories: Category[];
  activeCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  collapsed?: boolean;
};

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  collapsed = false,
}) => {
  return (
    <aside
      className={`flex h-full flex-col gap-2 rounded-xl bg-white p-2 shadow-soft transition-all ${
        collapsed ? 'w-20' : 'w-56'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`flex h-12 items-center justify-center rounded-lg border text-sm font-semibold transition hover:border-secondary hover:text-secondary ${
          activeCategoryId === null
            ? 'border-2 border-secondary bg-secondary/15 text-secondary shadow-sm'
            : 'border-slate-100 bg-slate-50 text-slate-700'
        }`}
      >
        {collapsed ? 'Все' : 'Все товары'}
      </button>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {categories.map((category) => {
          const isActive = category._id === activeCategoryId;
          return (
            <button
              key={category._id}
              type="button"
              onClick={() => onSelectCategory(category._id)}
              className={`flex h-12 w-full items-center justify-center rounded-lg border text-sm font-semibold transition hover:border-secondary hover:text-secondary ${
                isActive
                  ? 'border-2 border-secondary bg-secondary/15 text-secondary shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-700'
              }`}
            >
              {collapsed ? category.name.slice(0, 2).toUpperCase() : category.name}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default CategorySidebar;
