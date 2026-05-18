"use client";

import React, { useCallback } from "react";

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
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  autoComplete?: string;
  disabled?: boolean;
}

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
];

function sanitizeInput(value: string): string {
  let sanitized = value;
  XSS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });
  return sanitized
    .replace(/[<>]/g, "")
    .trim();
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
    maxLength = 500,
    min,
    max,
    step,
    autoComplete,
    disabled,
  } = props;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (type === "file") {
        onChange?.(e);
        return;
      }

      let newValue = e.target.value;

      if (type === "email") {
        newValue = newValue.toLowerCase().trim();
      } else if (type === "password") {
      } else {
        newValue = sanitizeInput(newValue);
      }

      if (maxLength && newValue.length > maxLength) {
        newValue = newValue.slice(0, maxLength);
      }

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: newValue,
          name: e.target.name,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange?.(syntheticEvent);
    },
    [onChange, type, maxLength]
  );

  const inputId = name ? `input-${name}` : undefined;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : null}
        </label>
      ) : null}
      <input
        id={inputId}
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        disabled={disabled || readOnly}
        maxLength={type !== "number" && type !== "date" ? maxLength : undefined}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-gray-800 placeholder-gray-400 text-sm ${
          error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        } ${readOnly || disabled ? "bg-gray-50 cursor-not-allowed opacity-60" : ""} ${className}`}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      {helperText && !error ? <p className="mt-1 text-sm text-gray-500">{helperText}</p> : null}
    </div>
  );
}