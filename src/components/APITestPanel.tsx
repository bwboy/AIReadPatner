import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { APIConfig, TestResult } from '@/types';

interface APITestPanelProps {
  apiConfig: APIConfig;
  onSave?: (config: APIConfig) => void;
}

export function APITestPanel({ apiConfig, onSave }: APITestPanelProps) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleTest = async () => {
    setIsLoading(true);
    try {
      // 这里实现实际的测试逻辑
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟测试过程
      setTestResult({ success: true, message: '测试连接成功' });
    } catch (error) {
      setTestResult({ success: false, message: '测试连接失败' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Button 
          onClick={handleTest} 
          disabled={isLoading}
        >
          {isLoading ? '测试中...' : '测试连接'}
        </Button>
        
        <Button
          onClick={() => onSave?.(apiConfig)}
          disabled={!testResult?.success}
          variant="outline"
        >
          保存配置
        </Button>
      </div>

      {testResult && (
        <div className={`mt-4 p-4 rounded ${
          testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {testResult.message}
        </div>
      )}
    </div>
  );
} 