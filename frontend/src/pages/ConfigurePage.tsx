import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, Slider,
  Select, MenuItem, FormControl, InputLabel, Grid, Autocomplete,
  Alert, Chip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useAnalysisStore from '../stores/analysisStore';
import { api } from '../services/api';
import ScienceIcon from '@mui/icons-material/Science';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import TuneIcon from '@mui/icons-material/Tune';

const ConfigurePage: React.FC = () => {
  const navigate = useNavigate();
  const { uploadInfo, setAnalysisId } = useAnalysisStore();

  const [method, setMethod] = useState('deseq2');
  const [logFc, setLogFc] = useState<number>(1.0);
  const [pValue, setPValue] = useState<number>(0.05);
  const [group1Name, setGroup1Name] = useState('Control');
  const [group2Name, setGroup2Name] = useState('Treatment');
  const [group1Samples, setGroup1Samples] = useState<string[]>([]);
  const [group2Samples, setGroup2Samples] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleNames = uploadInfo?.sample_names || [];
  const isReady = group1Samples.length >= 2 && group2Samples.length >= 2;

  const handleRunAnalysis = async () => {
    if (group1Samples.length === 0 || group2Samples.length === 0) {
      setError('Please select at least 2 samples for each group for reliable statistics.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.degs.analyze({
        project_id: 1,
        filename: uploadInfo?.filename || '',
        sample_group1: group1Samples,
        sample_group2: group2Samples,
        group1_name: group1Name,
        group2_name: group2Name,
        analysis_method: method === 'deseq2' ? 'DESeq2' : 't-test',
        logFC_threshold: logFc,
        p_value_threshold: pValue,
      });

      if (response.data && response.data.id) {
        setAnalysisId(response.data.id);
        navigate('/degs/results');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Stats about current configuration
  const overlap = group1Samples.filter(s => group2Samples.includes(s)).length;
  const unassigned = sampleNames.filter(s => !group1Samples.includes(s) && !group2Samples.includes(s)).length;

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 5, textAlign: 'center' }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '1.9rem', md: '2.4rem' },
            fontWeight: 800,
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
          }}
        >
          Configure Analysis
        </Typography>
        {uploadInfo && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`📄 ${uploadInfo.filename}`}
              size="small"
              sx={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
            />
            <Chip
              label={`${uploadInfo.genes?.toLocaleString()} genes`}
              size="small"
              sx={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
            />
            <Chip
              label={`${uploadInfo.samples} samples`}
              size="small"
              sx={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
            />
          </Box>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* ── Group Assignment ── */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <GroupWorkIcon sx={{ color: '#6366f1' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Sample Group Assignment</Typography>
                {unassigned > 0 && (
                  <Chip
                    label={`${unassigned} unassigned`}
                    size="small"
                    sx={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', ml: 'auto' }}
                  />
                )}
              </Box>

              <Grid container spacing={4}>
                {/* Group 1 */}
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    p: 3, borderRadius: 3,
                    border: '1px solid rgba(99,102,241,0.2)',
                    background: 'rgba(99,102,241,0.03)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#818cf8' }}>
                        Group 1
                      </Typography>
                      <Chip
                        label={`${group1Samples.length} samples`}
                        size="small"
                        sx={{ ml: 'auto', background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                    <TextField
                      fullWidth
                      label="Group Name"
                      value={group1Name}
                      onChange={(e) => setGroup1Name(e.target.value)}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      filterSelectedOptions
                      limitTags={3}
                      options={sampleNames.filter(s => !group2Samples.includes(s))}
                      value={group1Samples}
                      onChange={(_, newValue) => setGroup1Samples(newValue)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...chipProps } = getTagProps({ index });

                          return (
                            <Chip
                              key={key}
                              {...chipProps}
                              label={option}
                              size="small"
                            />
                          );
                        })
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Select Samples" placeholder="Add samples..." size="small" />
                      )}
                    />
                    {group1Samples.length < 2 && group1Samples.length > 0 && (
                      <Typography variant="caption" sx={{ color: '#fbbf24', mt: 1, display: 'block' }}>
                        ⚠ At least 2 samples required for DESeq2
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {/* Group 2 */}
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    p: 3, borderRadius: 3,
                    border: '1px solid rgba(16,185,129,0.2)',
                    background: 'rgba(16,185,129,0.03)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#34d399' }}>
                        Group 2
                      </Typography>
                      <Chip
                        label={`${group2Samples.length} samples`}
                        size="small"
                        sx={{ ml: 'auto', background: 'rgba(16,185,129,0.1)', color: '#34d399', fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                    <TextField
                      fullWidth
                      label="Group Name"
                      value={group2Name}
                      onChange={(e) => setGroup2Name(e.target.value)}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      filterSelectedOptions
                      limitTags={3}
                      options={sampleNames.filter(s => !group1Samples.includes(s))}
                      value={group2Samples}
                      onChange={(_, newValue) => setGroup2Samples(newValue)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...chipProps } = getTagProps({ index });

                          return (
                            <Chip
                              key={key}
                              {...chipProps}
                              label={option}
                              size="small"
                            />
                          );
                        })
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Select Samples" placeholder="Add samples..." size="small" />
                      )}
                    />
                    {group2Samples.length < 2 && group2Samples.length > 0 && (
                      <Typography variant="caption" sx={{ color: '#fbbf24', mt: 1, display: 'block' }}>
                        ⚠ At least 2 samples required for DESeq2
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {overlap > 0 && (
                <Alert severity="warning" sx={{ mt: 3, borderRadius: 2 }}>
                  {overlap} sample(s) are assigned to both groups. Please assign each sample to only one group.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Analysis Parameters ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <TuneIcon sx={{ color: '#3b82f6' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Statistical Parameters</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 4 }}>
                <InputLabel>Analysis Method</InputLabel>
                <Select value={method} label="Analysis Method" onChange={(e) => setMethod(e.target.value)}>
                  <MenuItem value="deseq2">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>DESeq2</Typography>
                      <Typography variant="caption" color="text.secondary">Negative binomial model · Best for raw counts</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="ttest">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>t-test + CPM normalization</Typography>
                      <Typography variant="caption" color="text.secondary">Simpler · Works with normalized data</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    log₂ Fold Change Threshold
                  </Typography>
                  <Chip
                    label={`± ${logFc}`}
                    size="small"
                    sx={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}
                  />
                </Box>
                <Slider
                  value={logFc}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(_, val) => setLogFc(val as number)}
                  sx={{
                    color: '#ef4444',
                    '& .MuiSlider-thumb': { boxShadow: '0 0 8px rgba(239,68,68,0.5)' },
                    '& .MuiSlider-rail': { opacity: 0.2 },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.disabled">0</Typography>
                  <Typography variant="caption" color="text.disabled">5</Typography>
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    p-value Threshold
                  </Typography>
                  <Chip
                    label={`p < ${pValue}`}
                    size="small"
                    sx={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontWeight: 700 }}
                  />
                </Box>
                <Slider
                  value={pValue}
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  onChange={(_, val) => setPValue(val as number)}
                  sx={{
                    color: '#6366f1',
                    '& .MuiSlider-thumb': { boxShadow: '0 0 8px rgba(99,102,241,0.5)' },
                    '& .MuiSlider-rail': { opacity: 0.2 },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.disabled">0.001</Typography>
                  <Typography variant="caption" color="text.disabled">0.1</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Summary & Launch ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 4, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <ScienceIcon sx={{ color: '#10b981' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Run Summary</Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: 'Method', value: method === 'deseq2' ? 'DESeq2' : 't-test (CPM)', color: '#818cf8' },
                  { label: `Group 1 (${group1Name})`, value: `${group1Samples.length} samples`, color: '#6366f1' },
                  { label: `Group 2 (${group2Name})`, value: `${group2Samples.length} samples`, color: '#10b981' },
                  { label: '|log₂FC| cutoff', value: `≥ ${logFc}`, color: '#ef4444' },
                  { label: 'p-value cutoff', value: `< ${pValue}`, color: '#f59e0b' },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>

            <Box sx={{ p: 4, pt: 0 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
              )}

              {!isReady && !error && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                  Assign ≥ 2 samples to each group to enable analysis.
                </Alert>
              )}

              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                startIcon={<ScienceIcon />}
                onClick={handleRunAnalysis}
                disabled={isLoading || !isReady || overlap > 0}
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                {isLoading ? 'Running Analysis...' : '🚀 Run Differential Expression'}
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ConfigurePage;
