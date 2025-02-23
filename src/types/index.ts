export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  // 其他配置项...
}

export interface TestResult {
  success: boolean;
  message: string;
} 