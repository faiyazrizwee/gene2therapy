import React from 'react';
import { Box, Typography, Grid, Chip } from '@mui/material';
import UploadForm from '../components/degs/UploadForm';
import { useNavigate } from 'react-router-dom';
import useAnalysisStore from '../stores/analysisStore';
import TableChartIcon from '@mui/icons-material/TableChart';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const setUploadInfo = useAnalysisStore((state) => state.setUploadInfo);

  const handleUploadSuccess = (info: any) => {
    setUploadInfo(info);
    navigate('/degs/configure');
  };

  const handleError = (error: string) => {
    console.error('Upload error:', error);
  };

  const steps = [
    { icon: <TableChartIcon sx={{ fontSize: 18 }} />, label: 'Upload Matrix', color: '#6366f1' },
    { icon: <GroupWorkIcon sx={{ fontSize: 18 }} />, label: 'Group Samples', color: '#3b82f6' },
    { icon: <BarChartIcon sx={{ fontSize: 18 }} />, label: 'View Results', color: '#10b981' },
  ];

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 5, textAlign: 'center' }}>
        <Typography
          variant="h1"
          gutterBottom
          sx={{
            fontSize: { xs: '1.9rem', md: '2.5rem' },
            fontWeight: 800,
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
          }}
        >
          Differential Expression Analyzer
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 580, mx: 'auto', mb: 4 }}>
          Upload a gene expression count matrix (genes × samples) and compare cohorts to discover
          significantly up- or down-regulated genes with interactive volcano visualization.
        </Typography>

        {/* Step indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1.5, md: 3 }, flexWrap: 'wrap' }}>
          {steps.map((step, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                borderRadius: 6,
                background: i === 0 ? `${step.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${i === 0 ? step.color + '44' : 'rgba(255,255,255,0.07)'}`,
                color: i === 0 ? step.color : 'text.disabled',
              }}>
                {step.icon}
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
                  {i + 1}. {step.label}
                </Typography>
              </Box>
              {i < steps.length - 1 && (
                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled', display: { xs: 'none', sm: 'block' } }} />
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Format hint */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8} sx={{ mx: 'auto' }}>
          <Box sx={{
            px: 3, py: 2,
            borderRadius: 3,
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              <strong style={{ color: '#818cf8' }}>Expected format:</strong>{' '}
              First column = gene IDs (Ensembl or gene symbol), remaining columns = sample read counts.
              Headers should be present. Rows are genes, columns are samples.
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Chip label=".csv" size="small" sx={{ fontSize: '0.7rem', height: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }} />
              <Chip label=".tsv" size="small" sx={{ fontSize: '0.7rem', height: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }} />
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Upload form */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8} sx={{ mx: 'auto' }}>
          <UploadForm onUploadSuccess={handleUploadSuccess} onError={handleError} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default UploadPage;
