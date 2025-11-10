export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorDetails;
  timestamp: string;
  path?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}
