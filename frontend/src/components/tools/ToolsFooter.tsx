import React from 'react';
import { Link } from 'react-router-dom';

const ToolsFooter: React.FC = () => (
  <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-600">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div><span className="font-semibold text-slate-900">Yago App</span> · инструменты для владельцев кофеен</div>
      <div className="flex flex-wrap gap-4">
        <Link to="/tools" className="hover:text-primary">Инструменты</Link>
        <Link to="/blog" className="hover:text-primary">Блог</Link>
        <Link to="/" className="hover:text-primary">POS-система</Link>
      </div>
    </div>
  </footer>
);

export default ToolsFooter;
