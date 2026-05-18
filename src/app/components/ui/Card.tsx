"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export default function Card(props: CardProps) {
  const { children, className = "", title, icon, onClick } = props;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-lg border border-green-100 overflow-hidden transition-all duration-300 hover:shadow-xl ${
        onClick ? "cursor-pointer hover:border-green-300" : ""
      } ${className}`}
    >
      {(title || icon) ? (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-green-50 flex items-center gap-3">
          {icon ? <div className="p-2 bg-green-100 rounded-lg text-green-700 flex-shrink-0">{icon}</div> : null}
          {title ? <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">{title}</h3> : null}
        </div>
      ) : null}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}