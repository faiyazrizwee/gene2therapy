import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, TablePagination, Button, LinearProgress, TextField, TableSortLabel,
  Stack
} from '@mui/material';
import Plot from 'react-plotly.js';
import useAnalysisStore from '../stores/analysisStore';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import DnaIcon from '@mui/icons-material/Biotech';
import HubIcon from '@mui/icons-material/Hub';
import MedicalIcon from '@mui/icons-material/LocalHospital';
import NetworkIcon from '@mui/icons-material/AccountTree';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import { CytoscapeNetwork } from '../components/common/CytoscapeNetwork';

const PathwayResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { pathwayAnalysisId } = useAnalysisStore();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Tab 0 (Side-by-Side Pathway Tables) States
  const [pathwayPage, setPathwayPage] = useState(0);
  const [pathwayRowsPerPage, setPathwayRowsPerPage] = useState(10);
  const [pathwaySearch, setPathwaySearch] = useState('');
  const [pathwaySortField, setPathwaySortField] = useState<string>('gene');
  const [pathwaySortOrder, setPathwaySortOrder] = useState<'asc' | 'desc'>('desc');

  const [summaryPage, setSummaryPage] = useState(0);
  const [summaryRowsPerPage, setSummaryRowsPerPage] = useState(10);
  const [summarySearch, setSummarySearch] = useState('');
  const [summarySortField, setSummarySortField] = useState<string>('gene');
  const [summarySortOrder, setSummarySortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedPathways, setExpandedPathways] = useState<Set<string>>(new Set());

  // Disease association table states
  const [diseasePage, setDiseasePage] = useState(0);
  const [diseaseRowsPerPage, setDiseaseRowsPerPage] = useState(10);
  const [diseaseSearch, setDiseaseSearch] = useState('');
  const [diseaseSortField, setDiseaseSortField] = useState<string>('association_score');
  const [diseaseSortOrder, setDiseaseSortOrder] = useState<'asc' | 'desc'>('desc');

  // Tab 4 (Drug Table) States
  const [drugPage, setDrugPage] = useState(0);
  const [drugRowsPerPage, setDrugRowsPerPage] = useState(10);
  const [drugSearch, setDrugSearch] = useState('');
  const [drugSortField, setDrugSortField] = useState<string>('gene');
  const [drugSortOrder, setDrugSortOrder] = useState<'asc' | 'desc'>('asc');

  const togglePathwayGenes = (pathwayId: string) => {
    setExpandedPathways(prev => {
      const next = new Set(prev);

      if (next.has(pathwayId)) {
        next.delete(pathwayId);
      } else {
        next.add(pathwayId);
      }

      return next;
    });
  };

  useEffect(() => {
    if (!pathwayAnalysisId) {
      setError('No pathway analysis ID found. Please start an analysis.');
      setIsLoading(false);
      return;
    }

    let intervalId: NodeJS.Timeout;

    const fetchResults = async () => {
      try {
        const response = await api.pathway.results(pathwayAnalysisId);
        const resultData = response.data.data;

        if (resultData.status === 'completed') {
          console.log("RESULT DATA:", resultData);
          setData(resultData);
          setIsLoading(false);
          clearInterval(intervalId);
        } else if (resultData.status === 'failed') {
          setError(resultData.error || 'Pathway analysis failed.');
          setIsLoading(false);
          clearInterval(intervalId);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch results');
        setIsLoading(false);
        clearInterval(intervalId);
      }
    };

    fetchResults();
    // Poll every 3 seconds
    intervalId = setInterval(fetchResults, 3000);

    return () => clearInterval(intervalId);
  }, [pathwayAnalysisId]);

  const pathways = useMemo(() => data?.pathways || [], [data]);
  const geneAnnotations = useMemo(() => data?.gene_annotations || [], [data]);
  console.log("GENE ANNOTATIONS:", geneAnnotations);
  const diseases = useMemo(() => data?.disease_results || [], [data]);
  const drugs = useMemo(() => data?.drugs || [], [data]);
  // const chemblDrugs = useMemo(() => data?.chembl_drugs || [], [data]);
  // console.log("CHEMBL DRUGS:", chemblDrugs);

  const pipelineSteps = [
    { label: 'Validating Genes', icon: <DnaIcon />, desc: 'Filtering and normalizing gene symbols' },
    { label: 'NCBI Annotation', icon: <DnaIcon />, desc: 'Fetching Entrez metadata for each gene' },
    { label: 'KEGG Pathway Mapping', icon: <NetworkIcon />, desc: 'Mapping gene IDs → KEGG pathway entries' },
    { label: 'Open Targets Query', icon: <MedicalIcon />, desc: 'Fetching disease & drug associations' },
    { label: 'Network Generation', icon: <HubIcon />, desc: 'Building interactive network layouts' },
    // { label: 'ChEMBL Annotation', icon: <MedicalIcon />, desc: 'Fetching molecular properties, SMILES and mechanisms of action from ChEMBL' },
  ];

  // Helper to trigger table sorting
  const handleSort = (field: string, currentField: string, setField: any, order: 'asc' | 'desc', setOrder: any) => {
    if (currentField === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setField(field);
      setOrder('asc');
    }
  };

  // Helper to export any table to CSV
  const exportToCSV = (rowsData: any[], filename: string, columns: { key: string; label: string }[]) => {
    const csvHeaders = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const csvRows = rowsData.map(row =>
      columns.map(c => {
        let val = '';
        if (c.key === 'genes' && Array.isArray(row[c.key])) {
          val = row[c.key].join('; ');
        } else if (c.key === 'therapeutic_areas' && Array.isArray(row[c.key])) {
          val = row[c.key].join('; ');
        } else {
          val = row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : '';
        }
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (rowsData: any[], filename: string, columns: { key: string; label: string }[]) => {
    const escapeHtml = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cellValue = (row: any, key: string) => {
      const value = row[key];
      if (Array.isArray(value)) return value.join('; ');
      return value !== undefined && value !== null ? String(value) : '';
    };
    const header = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const body = rowsData.map(row => (
      `<tr>${columns.map(c => `<td>${escapeHtml(cellValue(row, c.key))}</td>`).join('')}</tr>`
    )).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPlotImage = (divId: string, filename: string, format: 'png' | 'svg') => {
    const plotly = (window as any).Plotly;
    const plot = document.getElementById(divId);
    if (!plotly || !plot) return;
    plotly.downloadImage(plot, { format, filename, width: 1200, height: 800, scale: 2 });
  };

  const pathwayColumns = [
    { key: 'pathway_id', label: 'Gene Name' },
    { key: 'pathway_name', label: 'Gene ID (Entrez)' },
    { key: 'gene_count', label: 'Description' },
    { key: 'genes', label: 'Mapped Genes' }
  ];

  const pathwaySummaryColumns = [
    { key: 'pathway_id', label: 'Gene Name' },
    { key: 'pathway_name', label: 'Gene ID (Entrez)' },
    { key: 'gene_count', label: 'Description' }
  ];

  // const ncbiColumns = [
  //   { key: 'gene', label: 'Gene Symbol' },
  //   { key: 'ncbi_id', label: 'Entrez ID' },
  //   { key: 'description', label: 'Description' },
  //   { key: 'chromosome', label: 'Chromosome' },
  //   { key: 'genomic_location', label: 'Genomic Location' },
  //   { key: 'aliases', label: 'Aliases' }
  // ];


  const diseaseColumns = [
    { key: 'gene', label: 'Gene' },
    { key: 'gene_symbol', label: 'Approved Symbol' },
    { key: 'target', label: 'Ensembl ID' },
    { key: 'disease_name', label: 'Disease Name' },
    { key: 'disease_id', label: 'Disease ID' },
    { key: 'association_score', label: 'Association Score' },
    { key: 'therapeutic_areas', label: 'Therapeutic Area' }
  ];

  const drugColumns = [
    { key: 'gene', label: 'Gene' },
    { key: 'drug_name', label: 'Drug' },
    { key: 'drug_type', label: 'Drug Type' },
    { key: 'disease_name', label: 'Disease' },
    { key: 'moa', label: 'Mechanism' },
    { key: 'status', label: 'Status' },
    { key: 'phase', label: 'Phase' }
  ];

  const sortRows = (rows: any[], field: string, order: 'asc' | 'desc') => {
    return [...rows].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (Array.isArray(valA)) {
        return order === 'asc' ? valA.length - (valB as any[]).length : (valB as any[]).length - valA.length;
      }
      if (typeof valA === 'number' || typeof valB === 'number') {
        return order === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }
      return order === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  };

  const filteredSortedPathwaySummary = useMemo(() => {
    const q = summarySearch.toLowerCase().trim();
    const filtered = geneAnnotations.filter((r: any) =>
      !q ||
      (r.gene || "").toLowerCase().includes(q) ||
      String(r.ncbi_id || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    );
    return sortRows(filtered, summarySortField, summarySortOrder);
  }, [geneAnnotations, summarySearch, summarySortField, summarySortOrder]);

  // Pathway table filtering and sorting
  const filteredSortedPathways = useMemo(() => {
    let result = [...pathways];
    if (pathwaySearch.trim()) {
      const q = pathwaySearch.toLowerCase();
      result = result.filter(r =>
        (r.pathway_id || '').toLowerCase().includes(q) ||
        (r.pathway_name || '').toLowerCase().includes(q) ||
        (r.genes || []).some((g: string) => g.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      let valA = a[pathwaySortField];
      let valB = b[pathwaySortField];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (typeof valA === 'string') {
        return pathwaySortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      } else if (Array.isArray(valA)) {
        return pathwaySortOrder === 'asc' ? valA.length - (valB as any[]).length : (valB as any[]).length - valA.length;
      } else {
        return pathwaySortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });
    return result;
  }, [pathways, pathwaySearch, pathwaySortField, pathwaySortOrder]);

  const filteredSortedDiseases = useMemo(() => {
    let result = [...diseases];
    if (diseaseSearch.trim()) {
      const q = diseaseSearch.toLowerCase();
      result = result.filter(r =>
        (r.gene || '').toLowerCase().includes(q) ||
        (r.gene_symbol || '').toLowerCase().includes(q) ||
        (r.target || '').toLowerCase().includes(q) ||
        (r.disease_name || '').toLowerCase().includes(q) ||
        (r.disease_id || '').toLowerCase().includes(q) ||
        (r.therapeutic_areas || '').toLowerCase().includes(q)
      );
    }
    return sortRows(result, diseaseSortField, diseaseSortOrder);
  }, [diseases, diseaseSearch, diseaseSortField, diseaseSortOrder]);

  // Drug recommendations table filtering and sorting
  const filteredSortedDrugs = useMemo(() => {
    let result = [...drugs];
    if (drugSearch.trim()) {
      const q = drugSearch.toLowerCase();
      result = result.filter(r =>
        (r.gene || '').toLowerCase().includes(q) ||
        (r.drug_name || '').toLowerCase().includes(q) ||
        (r.drug_type || '').toLowerCase().includes(q) ||
        (r.moa || '').toLowerCase().includes(q) ||
        (r.disease_name || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let valA = a[drugSortField];
      let valB = b[drugSortField];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (typeof valA === 'string') {
        return drugSortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      } else {
        return drugSortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });
    return result;
  }, [drugs, drugSearch, drugSortField, drugSortOrder]);

  // Cytoscape components node/edge generator (Gene-Pathway)
  const genePathwayCytoscapeElements = useMemo(() => {
    if (!pathways || pathways.length === 0) return [];
    const nodes: any[] = [];
    const edges: any[] = [];
    const seen = new Set<string>();

    const topPathways = [...pathways].sort((a, b) => b.gene_count - a.gene_count).slice(0, 10);

    topPathways.forEach((p: any) => {
      const pNodeId = `pathway-${p.pathway_id}`;
      if (!seen.has(pNodeId)) {
        nodes.push({ data: { id: pNodeId, label: p.pathway_name.length > 24 ? p.pathway_name.slice(0, 21) + '...' : p.pathway_name, type: 'pathway', fullLabel: p.pathway_name } });
        seen.add(pNodeId);
      }
      (p.genes || []).slice(0, 15).forEach((g: string) => {
        const gNodeId = `gene-${g}`;
        if (!seen.has(gNodeId)) {
          nodes.push({ data: { id: gNodeId, label: g, type: 'gene' } });
          seen.add(gNodeId);
        }
        edges.push({ data: { id: `edge-${g}-${p.pathway_id}`, source: gNodeId, target: pNodeId } });
      });
    });
    return [...nodes, ...edges];
  }, [pathways]);

  // Cytoscape components node/edge generator (Gene-Disease-Drug)
  const geneDiseaseCytoscapeElements = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const seen = new Set<string>();
    const diseaseResults = data?.disease_results || [];

    // Top 10 diseases
    const diseaseCounts: Record<string, number> = {};
    diseaseResults.forEach((d: any) => {
      diseaseCounts[d.disease_name] = (diseaseCounts[d.disease_name] || 0) + 1;
    });
    const topDiseases = Object.keys(diseaseCounts).sort((a, b) => diseaseCounts[b] - diseaseCounts[a]).slice(0, 10);

    diseaseResults.filter((d: any) => topDiseases.includes(d.disease_name)).forEach((d: any) => {
      const gNodeId = `gene-${d.gene}`;
      const dNodeId = `disease-${d.disease_name}`;
      if (!seen.has(gNodeId)) {
        nodes.push({ data: { id: gNodeId, label: d.gene, type: 'gene' } });
        seen.add(gNodeId);
      }
      if (!seen.has(dNodeId)) {
        nodes.push({ data: { id: dNodeId, label: d.disease_name.length > 24 ? d.disease_name.slice(0, 21) + '...' : d.disease_name, type: 'disease', fullLabel: d.disease_name } });
        seen.add(dNodeId);
      }
      edges.push({ data: { id: `edge-${d.gene}-${d.disease_name}`, source: gNodeId, target: dNodeId, weight: d.association_score } });
    });

    // Top 10 drugs
    const drugCounts: Record<string, number> = {};
    drugs.forEach((dr: any) => {
      drugCounts[dr.drug_name] = (drugCounts[dr.drug_name] || 0) + 1;
    });
    const topDrugs = Object.keys(drugCounts).sort((a, b) => drugCounts[b] - drugCounts[a]).slice(0, 10);

    drugs.filter((dr: any) => topDrugs.includes(dr.drug_name) && dr.disease_name).forEach((dr: any) => {
      const drugNodeId = `drug-${dr.drug_name}`;
      const diseaseNodeId = `disease-${dr.disease_name}`;
      const geneNodeId = `gene-${dr.gene}`;

      if (!seen.has(drugNodeId)) {
        nodes.push({ data: { id: drugNodeId, label: dr.drug_name, type: 'drug' } });
        seen.add(drugNodeId);
      }
      if (seen.has(geneNodeId)) {
        edges.push({ data: { id: `edge-${dr.drug_name}-${dr.gene}`, source: drugNodeId, target: geneNodeId } });
      }
      if (seen.has(diseaseNodeId)) {
        edges.push({ data: { id: `edge-${dr.drug_name}-${dr.disease_name}`, source: drugNodeId, target: diseaseNodeId } });
      }
    });

    return [...nodes, ...edges];
  }, [data?.disease_results, drugs]);

  if (isLoading) {
    return (
      <Box sx={{ mt: 6, px: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
            <CircularProgress size={80} thickness={3} sx={{ color: '#10b981' }} />
            <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HubIcon sx={{ color: '#10b981', fontSize: 30 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Executing Biological Pipeline
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 550, mx: 'auto' }}>
            Multi-step genomic pipeline is running. NCBI API calls are rate-limited — this typically takes 30–90 seconds depending on your gene list size.
          </Typography>
        </Box>

        <Card sx={{ maxWidth: 680, mx: 'auto', p: 1 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              PIPELINE STAGES
            </Typography>
            {pipelineSteps.map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: idx < pipelineSteps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <Box sx={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>{step.icon}</Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{step.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{step.desc}</Typography>
                </Box>
                <CircularProgress size={16} thickness={5} sx={{ color: 'rgba(16,185,129,0.5)' }} />
              </Box>
            ))}
            <LinearProgress sx={{ mt: 2, borderRadius: 4, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6366f1, #10b981)' } }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Card sx={{ borderColor: 'error.main', borderWidth: 1 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error" variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              Analysis Execution Failed
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {error}
            </Typography>
            <Button variant="contained" color="primary" onClick={() => navigate('/pathway')}>
              Return to Configuration
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getPhaseBadge = (phase: string) => {
    const p = phase.trim().toUpperCase();
    if (p === '4' || p.includes('IV') || p.includes('4')) return <Chip label="Phase IV (Approved)" color="success" variant="outlined" size="small" />;
    if (p === '3' || p.includes('III') || p.includes('3')) return <Chip label="Phase III" color="secondary" variant="outlined" size="small" />;
    if (p === '2' || p.includes('II') || p.includes('2')) return <Chip label="Phase II" color="info" variant="outlined" size="small" />;
    if (p === '1' || p.includes('I') || p.includes('1')) return <Chip label="Phase I" color="warning" variant="outlined" size="small" />;
    return <Chip label={phase || 'Preclinical'} variant="outlined" size="small" />;
  };

  // 1. Horizontal pathway bar plot with dynamic colorscale & inline counts
  const topEnrichedPathways = [...pathways].sort((a: any, b: any) => b.gene_count - a.gene_count).slice(0, 20).reverse();
  const barChartData = [
    {
      y: topEnrichedPathways.map((p: any) => p.pathway_name.length > 35 ? p.pathway_name.slice(0, 32) + '...' : p.pathway_name),
      x: topEnrichedPathways.map((p: any) => p.gene_count),
      type: 'bar',
      orientation: 'h',
      text: topEnrichedPathways.map((p: any) => `${p.gene_count} genes`),
      textposition: 'inside',
      insidetextanchor: 'middle',
      hovertemplate: '<b>%{y}</b><br>Mapped Genes: %{x}<br>Enrichment Score: %{customdata:.2f}<extra></extra>',
      customdata: topEnrichedPathways.map((p: any) => p.enrichment_score || 0),
      marker: {
        color: topEnrichedPathways.map((p: any) => p.enrichment_score || 0),
        colorscale: [
          [0, '#3b82f6'],
          [0.5, '#6366f1'],
          [1, '#10b981']
        ],
        opacity: 0.9,
        line: { width: 0 },
      },
    },
  ];

  // 3. Pathway bubble plot data: X=count, Y=pathway, color=rank
  const rankedPathways = [...pathways].sort((a: any, b: any) => b.gene_count - a.gene_count).slice(0, 20).reverse();
  const bubblePlotData = [
    {
      x: rankedPathways.map((p: any) => p.gene_count),
      y: rankedPathways.map((p: any) => p.pathway_name.length > 36 ? p.pathway_name.slice(0, 33) + '...' : p.pathway_name),
      text: rankedPathways.map((p: any, idx: number) => `${p.pathway_name}<br>Rank: ${rankedPathways.length - idx}<br>Mapped Genes: ${p.gene_count}<br>Genes: ${(p.genes || []).join(', ')}`),
      mode: 'markers',
      hovertemplate: '%{text}<extra></extra>',
      marker: {
        size: rankedPathways.map((p: any) => Math.max(16, Math.min(56, p.gene_count * 7))),
        color: rankedPathways.map((_: any, idx: number) => rankedPathways.length - idx),
        colorscale: [
          [0, '#f59e0b'],
          [0.5, '#3b82f6'],
          [1, '#10b981'],
        ],
        showscale: true,
        line: { width: 1, color: '#ffffff' },
        colorbar: {
          title: 'Pathway Rank',
          titleside: 'top',
          tickfont: { color: '#9ca3af' }
        }
      }
    }
  ];

  const diseaseBubbleData = [
    {
      x: filteredSortedDiseases.slice(0, 40).map((d: any) => d.association_score),
      y: filteredSortedDiseases.slice(0, 40).map((d: any) => d.disease_name),
      text: filteredSortedDiseases.slice(0, 40).map((d: any) => `${d.gene_symbol || d.gene}<br>${d.disease_name}<br>${d.disease_id}<br>Score: ${Number(d.association_score || 0).toFixed(3)}<br>${d.therapeutic_areas || ''}`),
      mode: 'markers',
      hovertemplate: '%{text}<extra></extra>',
      marker: {
        size: filteredSortedDiseases.slice(0, 40).map((d: any) => Math.max(12, Math.min(48, Number(d.association_score || 0) * 42))),
        color: filteredSortedDiseases.slice(0, 40).map((d: any) => Number(d.association_score || 0)),
        colorscale: [
          [0, '#fca5a5'],
          [1, '#ef4444']
        ],
        showscale: true,
        line: { width: 1, color: '#ffffff' },
        colorbar: { title: 'Score', tickfont: { color: '#9ca3af' } }
      }
    }
  ];

  const drugPhaseCounts = (() => {
    const counts: Record<string, number> = {};
    drugs.forEach((d: any) => {
      const phase = d.phase ? d.phase.replace(/^PHASE_/, 'Phase ').replace(/_/, '/').replace('APPROVAL', 'Approved') : 'Unknown';
      counts[phase] = (counts[phase] || 0) + 1;
    });
    return counts;
  })();

  const topTargetedGenes = (() => {
    const counts: Record<string, number> = {};
    drugs.forEach((d: any) => {
      counts[d.gene] = (counts[d.gene] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  })();

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Pathway & Drug Discovery Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analysis completed · {summary.valid_genes_count} genes mapped across {summary.pathways_found} KEGG pathways
          </Typography>
        </Box>
        <Chip
          label="✓ Pipeline Completed"
          color="success"
          sx={{ fontWeight: 700, px: 2, fontSize: '0.85rem', height: 34 }}
        />
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #6366f1' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Genes Mapped</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {summary.valid_genes_count} <span style={{ fontSize: '1rem', color: '#9ca3af' }}>/ {summary.total_genes_submitted}</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #10b981' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>KEGG Pathways Mapped</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                {summary.pathways_found}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #f43f5e' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Associated Diseases</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'error.main' }}>
                {summary.diseases_found}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #3b82f6' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>OpenTarget Drugs</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                {summary.drugs_found}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderLeft: '4px solid #14b8a6' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>ChEMBL Drugs</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#14b8a6' }}>
                {chemblDrugs.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid> */}

      </Grid>
      {/* Tabs Layout */}
      <Card sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="secondary"
          textColor="secondary"
          variant={window.innerWidth < 1200 ? "scrollable" : "fullWidth"}
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <Tab label="NCBI Mapping" />
          <Tab label="Pathway Enrichment" />
          <Tab label="Disease Associations" />
          <Tab label="Drug Recommendations" />
          <Tab label="Networks" />
          {/* <Tab label="ChEMBL Drug Suggestions" /> */}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 0 - Side-by-Side Tables (Gene summary & Detailed Pathway mapping) */}
          {activeTab === 0 && (
            <Grid container spacing={4}>
              {/* Left Column: NCBI Gene Mapping Results */}
              <Grid item xs={12} lg={12}>
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      NCBI Gene Mapping Results
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        placeholder="Search Genes..."
                        value={summarySearch}
                        onChange={(e) => { setSummarySearch(e.target.value); setSummaryPage(0); }}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 0.5, fontSize: 18 }} />,
                        }}
                        sx={{ width: 200 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportToCSV(filteredSortedPathwaySummary, 'top_pathways_summary.csv', pathwaySummaryColumns)}
                      >
                        CSV
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportToExcel(filteredSortedPathwaySummary, 'top_pathways_summary.xls', pathwaySummaryColumns)}
                      >
                        Excel
                      </Button>
                    </Stack>
                  </Stack>
                  <TableContainer component={Paper} variant="outlined" sx={{ border: 'none', minHeight: 380 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                          <TableCell>
                            <TableSortLabel
                              active={summarySortField === 'pathway_id'}
                              direction={summarySortField === 'pathway_id' ? summarySortOrder : 'asc'}
                              onClick={() => handleSort('pathway_id', summarySortField, setSummarySortField, summarySortOrder, setSummarySortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              Gene Name
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={summarySortField === 'pathway_name'}
                              direction={summarySortField === 'pathway_name' ? summarySortOrder : 'asc'}
                              onClick={() => handleSort('pathway_name', summarySortField, setSummarySortField, summarySortOrder, setSummarySortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              Gene ID (Entrez)
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel sx={{ fontWeight: 700 }}>
                              Description
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel sx={{ fontWeight: 700 }}>
                              Chromosome
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel sx={{ fontWeight: 700 }}>
                              Genomic Location
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel sx={{ fontWeight: 700 }}>
                              Aliases
                            </TableSortLabel>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSortedPathwaySummary
                          .slice(summaryPage * summaryRowsPerPage, summaryPage * summaryRowsPerPage + summaryRowsPerPage)
                          .map((row: any, i: number) => (
                            <TableRow key={i} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{row.gene}</TableCell>
                              <TableCell>{row.ncbi_id}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: 'secondary.main' }}>{row.description}</TableCell>
                              <TableCell>{row.chromosome}</TableCell>
                              <TableCell>{row.genomic_location}</TableCell>
                              <TableCell>{Array.isArray(row.aliases) ? row.aliases.join(", ") : row.aliases}</TableCell>
                            </TableRow>
                          ))}
                        {filteredSortedPathwaySummary.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                              No matching pathways found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredSortedPathwaySummary.length}
                    rowsPerPage={summaryRowsPerPage}
                    page={summaryPage}
                    onPageChange={(_, page) => setSummaryPage(page)}
                    onRowsPerPageChange={(e) => {
                      setSummaryRowsPerPage(parseInt(e.target.value, 10));
                      setSummaryPage(0);
                    }}
                  />
                </Card>
              </Grid>

            </Grid>
          )}

          {/* Tab 1 - Enrichment Plots */}
          {activeTab === 1 && (
            <Stack spacing={4}>
              <Grid item xs={12} lg={6}>
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Detailed Mapping
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        placeholder="Search Pathways..."
                        value={pathwaySearch}
                        onChange={(e) => { setPathwaySearch(e.target.value); setPathwayPage(0); }}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 0.5, fontSize: 18 }} />,
                        }}
                        sx={{ width: 200 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportToCSV(filteredSortedPathways, 'detailed_pathway_mapping.csv', pathwayColumns)}
                      >
                        CSV
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportToExcel(filteredSortedPathways, 'detailed_pathway_mapping.xls', pathwayColumns)}
                      >
                        Excel
                      </Button>
                    </Stack>
                  </Stack>
                  <TableContainer component={Paper} variant="outlined" sx={{ border: 'none', minHeight: 380 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                          <TableCell>
                            <TableSortLabel
                              active={pathwaySortField === 'pathway_id'}
                              direction={pathwaySortField === 'pathway_id' ? pathwaySortOrder : 'asc'}
                              onClick={() => handleSort('pathway_id', pathwaySortField, setPathwaySortField, pathwaySortOrder, setPathwaySortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              ID
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={pathwaySortField === 'pathway_name'}
                              direction={pathwaySortField === 'pathway_name' ? pathwaySortOrder : 'asc'}
                              onClick={() => handleSort('pathway_name', pathwaySortField, setPathwaySortField, pathwaySortOrder, setPathwaySortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              Name
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={pathwaySortField === 'gene_count'}
                              direction={pathwaySortField === 'gene_count' ? pathwaySortOrder : 'asc'}
                              onClick={() => handleSort('gene_count', pathwaySortField, setPathwaySortField, pathwaySortOrder, setPathwaySortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              Description
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Mapped Genes</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSortedPathways
                          .slice(pathwayPage * pathwayRowsPerPage, pathwayPage * pathwayRowsPerPage + pathwayRowsPerPage)
                          .map((row: any, i: number) => (
                            <TableRow key={i} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{row.pathway_id}</TableCell>
                              <TableCell>{row.pathway_name}</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: 'secondary.main' }}>
                                {row.gene_count}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 400 }}>
                                {(expandedPathways.has(row.pathway_id)
                                  ? row.genes
                                  : row.genes.slice(0, 4)
                                ).map((g: string, idx: number) => (
                                  <Chip
                                    key={idx}
                                    label={g}
                                    size="small"
                                    sx={{
                                      mr: 0.5,
                                      mb: 0.5,
                                      fontSize: '0.65rem'
                                    }}
                                  />
                                ))}

                                {row.genes.length > 4 && (
                                  <Chip
                                    clickable
                                    color="primary"
                                    size="small"
                                    label={
                                      expandedPathways.has(row.pathway_id)
                                        ? "Show less"
                                        : `+${row.genes.length - 4} more`
                                    }
                                    onClick={() =>
                                      togglePathwayGenes(row.pathway_id)
                                    }
                                    sx={{
                                      ml: 0.5,
                                      fontSize: '0.65rem',
                                      cursor: 'pointer'
                                    }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        {filteredSortedPathways.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                              No matching pathways found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredSortedPathways.length}
                    rowsPerPage={pathwayRowsPerPage}
                    page={pathwayPage}
                    onPageChange={(_, page) => setPathwayPage(page)}
                    onRowsPerPageChange={(e) => {
                      setPathwayRowsPerPage(parseInt(e.target.value, 10));
                      setPathwayPage(0);
                    }}
                  />
                </Card>
              </Grid>
              <Grid container spacing={1}>
                {/* 1. Bar plot */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                        Top 20 Pathways by Description
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => exportPlotImage('pathway-bar-plot', 'top_pathways_bar', 'png')}>PNG</Button>
                        <Button size="small" variant="outlined" onClick={() => exportPlotImage('pathway-bar-plot', 'top_pathways_bar', 'svg')}>SVG</Button>
                        <Button size="small" variant="outlined" onClick={() => exportToCSV(topEnrichedPathways, 'top_pathways_bar.csv', pathwaySummaryColumns)}>CSV</Button>
                      </Stack>
                      <Box sx={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        {pathways.length > 0 ? (
                          <Plot
                            divId="pathway-bar-plot"
                            data={barChartData as any}
                            layout={{
                              paper_bgcolor: 'rgba(0,0,0,0)',
                              plot_bgcolor: 'rgba(0,0,0,0)',
                              font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                              xaxis: {
                                title: { text: 'Overlap Description', font: { color: '#6b7280' } },
                                gridcolor: 'rgba(255,255,255,0.06)',
                                tickfont: { size: 11 }
                              },
                              yaxis: {
                                automargin: true,
                                tickfont: { size: 11, color: '#d1d5db' }
                              },
                              margin: { l: 20, r: 30, t: 20, b: 50 },
                              height: 420,
                              bargap: 0.25,
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%' }}
                            config={{ displaylogo: false, responsive: true }}
                          />
                        ) : (
                          <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography color="text.secondary">No enriched pathways to display.</Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 2. Bubble plot */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                        Pathway Bubble Plot
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => exportPlotImage('pathway-bubble-plot', 'pathway_bubble', 'png')}>PNG</Button>
                        <Button size="small" variant="outlined" onClick={() => exportPlotImage('pathway-bubble-plot', 'pathway_bubble', 'svg')}>SVG</Button>
                        <Button size="small" variant="outlined" onClick={() => exportToCSV(rankedPathways, 'pathway_bubble.csv', pathwayColumns)}>CSV</Button>
                      </Stack>
                      <Box sx={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        {pathways.length > 0 ? (
                          <Plot
                            divId="pathway-bubble-plot"
                            data={bubblePlotData as any}
                            layout={{
                              paper_bgcolor: 'rgba(0,0,0,0)',
                              plot_bgcolor: 'rgba(0,0,0,0)',
                              font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                              xaxis: {
                                title: { text: 'Overlap Genes (Count)', font: { color: '#6b7280' } },
                                gridcolor: 'rgba(255,255,255,0.06)',
                                tickfont: { size: 11 }
                              },
                              yaxis: {
                                title: { text: 'Pathway', font: { color: '#6b7280' } },
                                gridcolor: 'rgba(255,255,255,0.06)',
                                tickfont: { size: 11, color: '#d1d5db' }
                              },
                              margin: { l: 260, r: 20, t: 25, b: 50 },
                              height: 420,
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%' }}
                            config={{ displaylogo: false, responsive: true }}
                          />
                        ) : (
                          <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography color="text.secondary">No data for bubble plot.</Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

            </Stack>
          )}


          {/* Tab 2 - Disease Associations */}
          {activeTab === 2 && (
            <Stack spacing={3}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Disease Associations</Typography>
                    <Typography variant="body2" color="text.secondary">
                      OpenTargets target-based disease associations with Ensembl target identifiers.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Search Diseases..."
                      value={diseaseSearch}
                      onChange={(e) => { setDiseaseSearch(e.target.value); setDiseasePage(0); }}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 0.5, fontSize: 18 }} />,
                      }}
                      sx={{ width: 200 }}
                    />
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportToCSV(filteredSortedDiseases, 'disease_associations.csv', diseaseColumns)}>
                      CSV
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportToExcel(filteredSortedDiseases, 'disease_associations.xls', diseaseColumns)}>
                      Excel
                    </Button>
                  </Stack>
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {[
                          ['gene', 'Gene'],
                          ['gene_symbol', 'Approved Symbol'],
                          ['target', 'Ensembl ID'],
                          ['disease_name', 'Disease Name'],
                          ['disease_id', 'Disease ID'],
                          ['association_score', 'Association Score'],
                          ['therapeutic_areas', 'Therapeutic Categories']
                        ].map(([field, label]) => (
                          <TableCell key={field}>
                            <TableSortLabel
                              active={diseaseSortField === field}
                              direction={diseaseSortField === field ? diseaseSortOrder : 'asc'}
                              onClick={() => handleSort(field, diseaseSortField, setDiseaseSortField, diseaseSortOrder, setDiseaseSortOrder)}
                              sx={{ fontWeight: 700 }}
                            >
                              {label}
                            </TableSortLabel>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSortedDiseases
                        .slice(diseasePage * diseaseRowsPerPage, diseasePage * diseaseRowsPerPage + diseaseRowsPerPage)
                        .map((row: any, i: number) => (
                          <TableRow key={`${row.gene}-${row.disease_id}-${i}`} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{row.gene}</TableCell>
                            <TableCell>{row.gene_symbol || row.gene}</TableCell>
                            <TableCell>{row.target}</TableCell>
                            <TableCell>{row.disease_name}</TableCell>
                            <TableCell>{row.disease_id}</TableCell>
                            <TableCell sx={{ color: 'error.light', fontWeight: 800 }}>{Number(row.association_score || 0).toFixed(3)}</TableCell>
                            <TableCell>{row.therapeutic_areas || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      {filteredSortedDiseases.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                            No disease associations found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredSortedDiseases.length}
                  rowsPerPage={diseaseRowsPerPage}
                  page={diseasePage}
                  onPageChange={(_, page) => setDiseasePage(page)}
                  onRowsPerPageChange={(e) => {
                    setDiseaseRowsPerPage(parseInt(e.target.value, 10));
                    setDiseasePage(0);
                  }}
                />
              </Card>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>Disease Association Bubble Plot</Typography>
                      <Typography variant="body2" color="text.secondary">Bubble size and color encode OpenTargets association score.</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => exportPlotImage('disease-bubble-plot', 'disease_association_bubble', 'png')}>PNG</Button>
                      <Button size="small" variant="outlined" onClick={() => exportPlotImage('disease-bubble-plot', 'disease_association_bubble', 'svg')}>SVG</Button>
                      <Button size="small" variant="outlined" onClick={() => exportToCSV(filteredSortedDiseases, 'disease_association_bubble.csv', diseaseColumns)}>CSV</Button>
                    </Stack>
                  </Stack>
                  {filteredSortedDiseases.length > 0 ? (
                    <Box sx={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <Plot
                        divId="disease-bubble-plot"
                        data={diseaseBubbleData as any}
                        layout={{
                          paper_bgcolor: 'rgba(0,0,0,0)',
                          plot_bgcolor: 'rgba(0,0,0,0)',
                          font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                          xaxis: { title: { text: 'Association Score', font: { color: '#6b7280' } }, gridcolor: 'rgba(255,255,255,0.06)' },
                          yaxis: { automargin: true, tickfont: { size: 10, color: '#d1d5db' } },
                          margin: { l: 220, r: 30, t: 20, b: 50 },
                          height: 520,
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%' }}
                        config={{ displaylogo: false, responsive: true }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography color="text.secondary">No disease association data available.</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* Tab 4 - ChEMBL Drug Suggestions */}
          {/*
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                ChEMBL Drug Suggestions
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Drug information retrieved from ChEMBL including molecular properties, SMILES, mechanism of action, and approval status.
              </Typography>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                    ChEMBL Drugs Found: {chemblDrugs.length}
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><b>Gene</b></TableCell>
                          <TableCell><b>ChEMBL ID</b></TableCell>
                          <TableCell><b>Drug Name</b></TableCell>
                          <TableCell><b>Phase</b></TableCell>
                          <TableCell><b>Molecule Type</b></TableCell>
                          <TableCell><b>Mol. Weight</b></TableCell>
                          <TableCell><b>Mechanism</b></TableCell>
                          <TableCell><b>Structure</b></TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {chemblDrugs.map((drug: any, idx: number) => (
                          <TableRow key={idx} hover>
                            <TableCell>{drug.gene || 'N/A'}</TableCell>
                            <TableCell>{drug.chembl_id || 'N/A'}</TableCell>
                            <TableCell>{drug.drug_name || 'N/A'}</TableCell>
                            <TableCell>{drug.max_phase || 'N/A'}</TableCell>
                            <TableCell>{drug.molecule_type || 'N/A'}</TableCell>
                            <TableCell>{drug.molecular_weight || 'N/A'}</TableCell>
                            <TableCell sx={{ maxWidth: 300 }}>
                              {drug.mechanism_of_action || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {drug.structure_url ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  href={drug.structure_url}
                                  target="_blank"
                                >
                                  View
                                </Button>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}

                        {chemblDrugs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              No ChEMBL drugs found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}
          */}


          {/* Tab 3 - Drug Recommendations Table */}
          {activeTab === 3 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Discovered Drug Candidates & Clinical trials
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Matched drugs from Open Targets API based on target gene profiles.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    placeholder="Search Drugs..."
                    value={drugSearch}
                    onChange={(e) => { setDrugSearch(e.target.value); setDrugPage(0); }}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 0.5, fontSize: 18 }} />,
                    }}
                    sx={{ width: 200 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => exportToCSV(filteredSortedDrugs, 'drug_recommendations.csv', drugColumns)}
                  >
                    CSV
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => exportToExcel(filteredSortedDrugs, 'drug_recommendations.xls', drugColumns)}
                  >
                    Excel
                  </Button>
                </Stack>
              </Stack>
              <Card variant="outlined" sx={{ mb: 4 }}>
                <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <TableCell>
                          <TableSortLabel
                            active={drugSortField === 'gene'}
                            direction={drugSortField === 'gene' ? drugSortOrder : 'asc'}
                            onClick={() => handleSort('gene', drugSortField, setDrugSortField, drugSortOrder, setDrugSortOrder)}
                            sx={{ fontWeight: 700 }}
                          >
                            Target Gene
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={drugSortField === 'drug_name'}
                            direction={drugSortField === 'drug_name' ? drugSortOrder : 'asc'}
                            onClick={() => handleSort('drug_name', drugSortField, setDrugSortField, drugSortOrder, setDrugSortOrder)}
                            sx={{ fontWeight: 700 }}
                          >
                            Drug Name
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={drugSortField === 'drug_type'}
                            direction={drugSortField === 'drug_type' ? drugSortOrder : 'asc'}
                            onClick={() => handleSort('drug_type', drugSortField, setDrugSortField, drugSortOrder, setDrugSortOrder)}
                            sx={{ fontWeight: 700 }}
                          >
                            Drug Type
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={drugSortField === 'phase'}
                            direction={drugSortField === 'phase' ? drugSortOrder : 'asc'}
                            onClick={() => handleSort('phase', drugSortField, setDrugSortField, drugSortOrder, setDrugSortOrder)}
                            sx={{ fontWeight: 700 }}
                          >
                            Clinical Stage
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Mechanism of Action</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={drugSortField === 'disease_name'}
                            direction={drugSortField === 'disease_name' ? drugSortOrder : 'asc'}
                            onClick={() => handleSort('disease_name', drugSortField, setDrugSortField, drugSortOrder, setDrugSortOrder)}
                            sx={{ fontWeight: 700 }}
                          >
                            Indication Disease
                          </TableSortLabel>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSortedDrugs
                        .slice(drugPage * drugRowsPerPage, drugPage * drugRowsPerPage + drugRowsPerPage)
                        .map((row: any, i: number) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.gene}</TableCell>
                            <TableCell sx={{ color: 'secondary.light', fontWeight: 700 }}>{row.drug_name}</TableCell>
                            <TableCell>{row.drug_type || 'Small Molecule'}</TableCell>
                            <TableCell>{getPhaseBadge(row.phase)}</TableCell>
                            <TableCell sx={{ maxWidth: 280, textOverflow: 'ellipsis', overflow: 'hidden' }}>{row.moa}</TableCell>
                            <TableCell>{row.disease_name}</TableCell>
                          </TableRow>
                        ))}
                      {filteredSortedDrugs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                            No drug recommendations matching filter criteria discovered.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredSortedDrugs.length}
                  rowsPerPage={drugRowsPerPage}
                  page={drugPage}
                  onPageChange={(_, page) => setDrugPage(page)}
                  onRowsPerPageChange={(e) => {
                    setDrugRowsPerPage(parseInt(e.target.value, 10));
                    setDrugPage(0);
                  }}
                />
              </Card>

              <Grid container spacing={3} sx={{ mt: 2 }}>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Drug Phase Distribution</Typography>
                      {Object.keys(drugPhaseCounts).length > 0 ? (
                        <Plot
                          divId="drug-phase-distribution"
                          data={[{
                            x: Object.keys(drugPhaseCounts),
                            y: Object.values(drugPhaseCounts),
                            type: 'bar',
                            marker: { color: '#f59e0b' },
                            text: Object.values(drugPhaseCounts).map(v => String(v)),
                            textposition: 'auto'
                          }] as any}
                          layout={{
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                            xaxis: { title: { text: 'Clinical Phase', font: { color: '#6b7280' } } },
                            yaxis: { title: { text: 'Drug Count', font: { color: '#6b7280' } }, gridcolor: 'rgba(255,255,255,0.06)' },
                            margin: { l: 50, r: 20, t: 10, b: 50 },
                            height: 320,
                          }}
                          useResizeHandler
                          style={{ width: '100%' }}
                          config={{ displaylogo: false, responsive: true }}
                        />
                      ) : (
                        <Typography color="text.secondary">No phase data available.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Top Targeted Genes</Typography>
                      {topTargetedGenes.length > 0 ? (
                        <Plot
                          divId="top-targeted-genes"
                          data={[{
                            x: topTargetedGenes.map(([, count]) => count),
                            y: topTargetedGenes.map(([gene]) => gene),
                            type: 'bar',
                            orientation: 'h',
                            marker: { color: '#3b82f6' },
                            text: topTargetedGenes.map(([, count]) => `${count} drugs`),
                            textposition: 'auto'
                          }] as any}
                          layout={{
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                            xaxis: { title: { text: 'Drug Count', font: { color: '#6b7280' } }, gridcolor: 'rgba(255,255,255,0.06)' },
                            yaxis: { automargin: true },
                            margin: { l: 90, r: 20, t: 10, b: 50 },
                            height: 320,
                          }}
                          useResizeHandler
                          style={{ width: '100%' }}
                          config={{ displaylogo: false, responsive: true }}
                        />
                      ) : (
                        <Typography color="text.secondary">No target-drug data available.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

            </Box>
          )}

          {/* Tab 4 - Gene-Disease-Drug Network */}
          {activeTab === 4 && (
            <Stack spacing={4}>
              <Box sx={{ height: 800 }}>
                <CytoscapeNetwork
                  elements={genePathwayCytoscapeElements}
                  title="Gene-Pathway Interaction Network"
                  subtitle="Explore direct connections between target genes and their mapped biological pathways."
                />
              </Box>

              <Box sx={{ height: 800 }}>
                {data.disease_results && data.disease_results.length > 0 ? (
                  <CytoscapeNetwork
                    elements={geneDiseaseCytoscapeElements}
                    title="Target-Disease-Drug Association Network"
                    subtitle="Explore linkages between mapped genomic targets, clinical therapeutics, and indication diseases."
                  />
                ) : (
                  <Box sx={{ py: 10, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No therapeutic/drug associations retrieved for these targets to render the network.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </Box>
      </Card>
    </Box>
  );
};

export default PathwayResultsPage;
