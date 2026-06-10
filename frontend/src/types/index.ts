export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface Analysis {
  id: number;
  project_id: number;
  analysis_type: 'degs' | 'pathway' | 'drugs';
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface DEGResult {
  id: number;
  gene: string;
  logFC: number;
  p_value: number;
  adj_p_value?: number;
  mean_group1: number;
  mean_group2: number;
}

export interface AnalysisResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
