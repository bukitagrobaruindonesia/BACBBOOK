"use client";

import React, { useCallback } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function Select(props: SelectProps) {
  const {
    label,
    name,
    value,
    onChange,
    options,
    placeholder,
    error,
    required,
    className = "",
    disabled,
  } = props;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = e.target.value;

      const isValidOption = options.some((opt) => opt.value === selectedValue);
      if (!isValidOption && selectedValue !== "") {
        return;
      }

      onChange?.(e);
    },
    [onChange, options]
  );

  const selectId = name ? `select-${name}` : undefined;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : null}
        </label>
      ) : null}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-gray-800 text-sm ${
          error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        } ${disabled ? "bg-gray-50 cursor-not-allowed opacity-60" : ""} ${className}`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}