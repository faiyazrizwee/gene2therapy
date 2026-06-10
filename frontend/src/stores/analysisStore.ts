import { create } from 'zustand';
import { DEGResult } from '../types';

interface UploadInfo {
  filename: string;
  genes: number;
  samples: number;
  sample_names: string[];
}

interface AnalysisStore {
  uploadInfo: UploadInfo | null;
  analysisId: number | null;
  status: string;
  results: DEGResult[];
  error: string | null;
  
  // Pathway Analysis State
  pathwayAnalysisId: number | null;
  pathwayStatus: string;
  pathwayError: string | null;
  pathwayResults: any;
  
  setUploadInfo: (info: UploadInfo | null) => void;
  setAnalysisId: (id: number | null) => void;
  setStatus: (status: string) => void;
  setResults: (results: DEGResult[]) => void;
  setError: (error: string | null) => void;
  
  setPathwayAnalysisId: (id: number | null) => void;
  setPathwayStatus: (status: string) => void;
  setPathwayError: (error: string | null) => void;
  setPathwayResults: (results: any) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  uploadInfo: null,
  analysisId: null,
  status: 'idle',
  results: [],
  error: null,
  
  pathwayAnalysisId: null,
  pathwayStatus: 'idle',
  pathwayError: null,
  pathwayResults: null,
  
  setUploadInfo: (info) => set({ uploadInfo: info }),
  setAnalysisId: (id) => set({ analysisId: id }),
  setStatus: (status) => set({ status }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  
  setPathwayAnalysisId: (id) => set({ pathwayAnalysisId: id }),
  setPathwayStatus: (status) => set({ pathwayStatus: status }),
  setPathwayError: (error) => set({ pathwayError: error }),
  setPathwayResults: (results) => set({ pathwayResults: results }),
  reset: () => set({
    uploadInfo: null,
    analysisId: null,
    status: 'idle',
    results: [],
    error: null,
    pathwayAnalysisId: null,
    pathwayStatus: 'idle',
    pathwayError: null,
    pathwayResults: null,
  }),
}));

export default useAnalysisStore;
