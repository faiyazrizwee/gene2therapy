import React, { useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert, Chip, LinearProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../services/api';

interface FileUploadInfo {
  filename: string;
  genes: number;
  samples: number;
  sample_names: string[];
}

interface UploadFormProps {
  onUploadSuccess: (info: FileUploadInfo) => void;
  onError: (error: string) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess, onError }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadInfo, setUploadInfo] = useState<FileUploadInfo | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (file: File) => {
    setLocalError(null);
    setUploadInfo(null);

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv')) {
      setLocalError('Please select a CSV or TSV file.');
      onError('Invalid file type');
      return;
    }

    setUploadedFile(file);
    setIsLoading(true);

    try {
      const response = await api.degs.upload(file);
      if (response.data.success) {
        setUploadInfo(response.data.data);
        onUploadSuccess(response.data.data);
      } else {
        const msg = response.data.error || 'Upload failed';
        setLocalError(msg);
        onError(msg);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Upload failed';
      setLocalError(msg);
      onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        {/* Drop zone */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: isDragOver
              ? '#6366f1'
              : uploadInfo
              ? '#10b981'
              : 'rgba(255,255,255,0.12)',
            borderRadius: 3,
            py: 6,
            px: 4,
            textAlign: 'center',
            cursor: isLoading ? 'wait' : 'pointer',
            background: isDragOver
              ? 'rgba(99,102,241,0.07)'
              : uploadInfo
              ? 'rgba(16,185,129,0.04)'
              : 'rgba(255,255,255,0.01)',
            transition: 'all 0.25s ease',
            '&:hover': !isLoading && !uploadInfo ? {
              borderColor: '#6366f1',
              background: 'rgba(99,102,241,0.05)',
            } : {},
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={48} thickness={3} sx={{ color: '#6366f1' }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>Uploading & parsing matrix...</Typography>
              <Typography variant="body2" color="text.secondary">{uploadedFile?.name}</Typography>
              <LinearProgress
                sx={{
                  width: 240, borderRadius: 4,
                  '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6366f1, #818cf8)' }
                }}
              />
            </Box>
          ) : uploadInfo ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 52, color: '#10b981' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#34d399' }}>
                File Loaded Successfully
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip
                  icon={<InsertDriveFileIcon />}
                  label={uploadedFile?.name}
                  size="small"
                  sx={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                />
                <Chip
                  label={`${uploadInfo.genes?.toLocaleString()} genes`}
                  size="small"
                  sx={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                />
                <Chip
                  label={`${uploadInfo.samples} samples`}
                  size="small"
                  sx={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                />
                {uploadedFile && (
                  <Chip
                    label={formatFileSize(uploadedFile.size)}
                    size="small"
                    sx={{ background: 'rgba(255,255,255,0.05)', color: 'text.secondary' }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Click to replace file · Proceeding to sample configuration...
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px',
                background: isDragOver ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${isDragOver ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.15)'}`,
                transition: 'all 0.2s ease',
                mb: 1,
              }}>
                <CloudUploadIcon sx={{ fontSize: 32, color: isDragOver ? '#818cf8' : '#6366f1' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {isDragOver ? 'Drop your file here' : 'Drag & drop your count matrix'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse files
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label=".csv" size="small" sx={{ fontSize: '0.7rem', height: 20, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.15)' }} />
                <Chip label=".tsv" size="small" sx={{ fontSize: '0.7rem', height: 20, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.15)' }} />
              </Box>
            </Box>
          )}
        </Box>

        {localError && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{localError}</Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadForm;
