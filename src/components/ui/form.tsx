import React from 'react';
import { UseFormReturn } from 'react-hook-form';

interface FormProps {
  children: React.ReactNode;
}

export function Form({ children }: FormProps & { [key: string]: any }) {
  return <div className="w-full">{children}</div>;
} 