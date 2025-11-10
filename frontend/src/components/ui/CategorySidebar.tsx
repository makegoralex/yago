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
      className={`flex h-full flex-col gap-3 rounded-2xl bg-white p-3 shadow-soft transition-all ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`flex min-h-[56px] items-center justify-center rounded-2xl border text-sm font-semibold transition hover:border-secondary hover:text-secondary ${
          activeCategoryId === null
            ? 'border-secondary bg-secondary/10 text-secondary'
            : 'border-transparent bg-slate-100 text-slate-600'
        }`}
      >
        {collapsed ? 'Все' : 'Все товары'}
      </button>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {categories.map((category) => {
          const isActive = category._id === activeCategoryId;
          return (
            <button
              key={category._id}
              type="button"
              onClick={() => onSelectCategory(category._id)}
              className={`flex min-h-[56px] w-full items-center justify-center rounded-2xl border text-sm font-semibold transition hover:border-secondary hover:text-secondary ${
                isActive ? 'border-secondary bg-secondary/10 text-secondary' : 'border-transparent bg-slate-100 text-slate-600'
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
