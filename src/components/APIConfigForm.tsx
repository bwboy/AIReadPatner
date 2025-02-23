import React, { useState } from 'react';
import { Form } from '@/components/ui/form';
import { toast } from 'react-hot-toast';
import { APITestPanel } from './APITestPanel';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { APIConfig } from '@/types';

interface APIConfigFormProps {
  onSubmit: (config: APIConfig) => void;
}

const formSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1)
});

export function APIConfigForm({ onSubmit }: APIConfigFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      baseUrl: '',
      apiKey: '',
      model: ''
    }
  });

  const handleSave = (config: APIConfig) => {
    onSubmit(config);
    toast.success('API配置已保存！');
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* ... existing form fields ... */}
        
        <APITestPanel 
          apiConfig={form.getValues()} 
          onSave={handleSave}
        />
      </form>
    </Form>
  );
} 