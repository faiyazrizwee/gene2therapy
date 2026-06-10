import React, { useState, useRef } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Checkbox, Grid, Alert, Chip, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useAnalysisStore from '../stores/analysisStore';
import { api } from '../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HubIcon from '@mui/icons-material/Hub';
import BiotechIcon from '@mui/icons-material/Biotech';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
// import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ClearIcon from '@mui/icons-material/Clear';

const PathwayInputPage: React.FC = () => {
  const navigate = useNavigate();
  const { setPathwayAnalysisId, setPathwayStatus, setPathwayError, setPathwayResults } = useAnalysisStore();

  const [genesText, setGenesText] = useState('');
  const [organism, setOrganism] = useState('human');
  const [includeDrugs, setIncludeDrugs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Example genes to load quickly
  const loadExampleGenes = () => {
    setUploadedFileName(null);
    setGenesText('TP53, EGFR, BRCA1, BRCA2, KRAS, PTEN, APC, RB1, MYC, PIK3CA, AKT1, MTOR, VEGFA, FLT3, BRAF, MET, RET, KIT');
  };

  // Parse gene symbols from string
  const parseGenes = (text: string): string[] => {
    return text
      .split(/[\s,;\t\n]+/)
      .map(g => g.trim().toUpperCase())
      .filter(g => g.length >= 2 && /^[A-Z0-9\-_]+$/.test(g));
  };

  // Process file contents
  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseGenes(text);
      if (parsed.length > 0) {
        setGenesText(parsed.join(', '));
        setUploadedFileName(file.name);
        setError(null);
      } else {
        setError('No valid gene symbols found in file. Please make sure symbols are standard alphanumeric tags.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  // Handle file upload selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Drag and drop handlers
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGenesText('');
    setUploadedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartAnalysis = async () => {
    const parsedGenes = parseGenes(genesText);

    if (parsedGenes.length === 0) {
      setError('Please enter at least one valid gene symbol.');
      return;
    }

    if (parsedGenes.length > 200) {
      setError('Maximum limit is 200 genes for local queue processing.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setPathwayStatus('pending');
    setPathwayError(null);
    setPathwayResults(null);

    try {
      const projectId = 1; // Default project
      const response = await api.pathway.analyze({
        project_id: projectId,
        genes: parsedGenes,
        organism,
        include_drugs: includeDrugs
      });

      if (response.data && response.data.id) {
        setPathwayAnalysisId(response.data.id);
        navigate('/pathway/results');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to initialize analysis';
      setError(errMsg);
      setPathwayStatus('failed');
      setPathwayError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 5, textAlign: 'center' }}>
        <Typography variant="h1" gutterBottom sx={{ fontSize: { xs: '1.9rem', md: '2.5rem' }, background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800, mb: 1 }}>
          Pathway Enrichment & Drug Discovery
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620, mx: 'auto' }}>
          Input gene signatures to identify enriched KEGG pathways, fetch NCBI annotations, and search for clinical drug matches.
        </Typography>
      </Box>

      {/* Pipeline Flow Banner */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, md: 2 }, flexWrap: 'wrap' }}>
        {[
          { icon: <CheckCircleIcon sx={{ fontSize: 18 }} />, label: 'Gene Validation', color: '#818cf8' },
          { icon: <BiotechIcon sx={{ fontSize: 18 }} />, label: 'NCBI Entrez', color: '#6366f1' },
          { icon: <AccountTreeIcon sx={{ fontSize: 18 }} />, label: 'KEGG Pathways', color: '#3b82f6' },
          { icon: <LocalHospitalIcon sx={{ fontSize: 18 }} />, label: 'Open Targets', color: '#10b981' },
          // { icon: <ScienceIcon sx={{ fontSize: 18 }} />, label: 'ChEMBL', color: '#14b8a6' },
        ].map((step, i) => (
          <React.Fragment key={i}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
              background: `${step.color}14`,
              border: `1px solid ${step.color}33`,
              borderRadius: 6, color: step.color
            }}>
              {step.icon}
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.03em' }}>{step.label}</Typography>
            </Box>
            {i < 3 && (
              <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 18, display: { xs: 'none', sm: 'block' } }} />
            )}
          </React.Fragment>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
      )}

      <Grid container spacing={4}>
        {/* Left Column - Gene Inputs */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Enter Gene List</Typography>
                <Button size="small" onClick={loadExampleGenes} sx={{ color: '#818cf8' }}>
                  Load Cancer Example
                </Button>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={8}
                variant="outlined"
                placeholder="Enter gene symbols separated by spaces, commas, or newlines (e.g. TP53, EGFR, BRCA1)..."
                value={genesText}
                onChange={(e) => setGenesText(e.target.value)}
                sx={{ mb: 3 }}
              />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Parsed: <strong>{parseGenes(genesText).length}</strong> unique valid symbols (max 200).
              </Typography>

              {/* File Upload Area */}
              <Box
                component="div"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploadedFileName && fileInputRef.current?.click()}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  border: '2px dashed',
                  borderColor: isDragOver
                    ? '#6366f1'
                    : uploadedFileName
                      ? '#10b981'
                      : 'rgba(255,255,255,0.12)',
                  borderRadius: 3,
                  p: 4,
                  cursor: uploadedFileName ? 'default' : 'pointer',
                  textAlign: 'center',
                  background: isDragOver
                    ? 'rgba(99,102,241,0.07)'
                    : uploadedFileName
                      ? 'rgba(16,185,129,0.04)'
                      : 'rgba(255,255,255,0.01)',
                  transition: 'all 0.25s ease',
                  '&:hover': !uploadedFileName ? {
                    borderColor: '#6366f1',
                    background: 'rgba(99,102,241,0.05)',
                    '& .upload-icon': { color: '#818cf8' },
                  } : {},
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />

                {uploadedFileName ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 44, color: '#10b981' }} />
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#34d399' }}>
                      File Loaded Successfully
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Chip
                        icon={<InsertDriveFileIcon sx={{ fontSize: 16 }} />}
                        label={uploadedFileName}
                        size="small"
                        sx={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                      />
                      <Chip
                        label={`${parseGenes(genesText).length} genes`}
                        size="small"
                        sx={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                      />
                      <IconButton size="small" onClick={handleClearFile} sx={{ color: 'text.secondary', '&:hover': { color: '#f43f5e' } }}>
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Box sx={{
                      width: 52, height: 52, borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.15)',
                    }}>
                      <CloudUploadIcon className="upload-icon" sx={{ fontSize: 28, color: '#6366f1', transition: 'color 0.2s' }} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {isDragOver ? 'Drop your file here' : 'Upload Gene List from File'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Supports .txt, .csv, .tsv — one gene per line or comma-separated
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Pipeline Configuration */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
                Pipeline Configuration
              </Typography>

              {/* Organism Selector */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Organism Database</InputLabel>
                <Select
                  value={organism}
                  label="Organism Database"
                  onChange={(e) => setOrganism(e.target.value)}
                >
                  <MenuItem value="human">Homo sapiens (Human)</MenuItem>
                  <MenuItem value="mouse">Mus musculus (Mouse)</MenuItem>
                  <MenuItem value="rat">Rattus norvegicus (Rat)</MenuItem>
                </Select>
              </FormControl>

              {/* include drugs query */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeDrugs}
                    onChange={(e) => setIncludeDrugs(e.target.checked)}
                    color="secondary"
                  />
                }
                label="Query Open Targets Therapeutic Associations"
                sx={{ mb: 3, display: 'block' }}
              />

              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Services Included:
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">• NCBI Entrez Gene Search</Typography>
                <Typography variant="caption" display="block" color="text.secondary">• KEGG API ID Conversion & Pathway Fetching</Typography>
                {includeDrugs && <Typography variant="caption" display="block" color="text.secondary">• Open Targets GraphQL Target Mapping</Typography>}
                {includeDrugs && <Typography variant="caption" display="block" color="text.secondary">• Disease Target Associations & Drug Matches</Typography>}
              </Box>
            </CardContent>

            <Box sx={{ p: 4 }}>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                startIcon={<HubIcon />}
                onClick={handleStartAnalysis}
                disabled={isLoading}
                sx={{ py: 1.5, fontSize: '1.1rem' }}
              >
                {isLoading ? 'Processing Pipeline...' : '🚀 Execute Pathway Analysis'}
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PathwayInputPage;
