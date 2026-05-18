"use client";

import React from "react";

interface InputProps {
  label?: string;
  type?: string;
  name?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}

export default function Input(props: InputProps) {
  const {
    label,
    type = "text",
    name,
    value,
    onChange,
    placeholder,
    error,
    helperText,
    required,
    readOnly,
    className = "",
  } = props;

  return (
    <div className="w-full">
      {label ? (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : null}
        </label>
      ) : null}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-gray-800 placeholder-gray-400 text-sm ${
          error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        } ${readOnly ? "bg-gray-50" : ""} ${className}`}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      {helperText && !error ? <p className="mt-1 text-sm text-gray-500">{helperText}</p> : null}
    </div>
  );
}