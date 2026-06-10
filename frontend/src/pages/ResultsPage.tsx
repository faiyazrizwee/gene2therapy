import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TablePagination, LinearProgress, Alert,
  Tabs, Tab, TextField, InputAdornment, TableSortLabel, Stack
} from '@mui/material';
import Plot from 'react-plotly.js';
import PlotlyDownload from 'plotly.js/dist/plotly.min.js';
import useAnalysisStore from '../stores/analysisStore';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ScienceIcon from '@mui/icons-material/Science';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

type SortKey = 'gene' | 'logFC' | 'p_value' | 'adj_p_value' | 'direction';
type SortDirection = 'asc' | 'desc';

interface DEGRow {
  gene: string;
  logFC: number;
  p_value: number;
  adj_p_value?: number;
  mean_group1?: number;
  mean_group2?: number;
}

interface HeatmapRow {
  gene: string;
  group1: number;
  group2: number;
  logFC: number;
}

interface MAPlotRow {
  gene: string;
  A: number;
  logFC: number;
  p_value: number;
  adj_p_value: number;
  significant: boolean;
}

const formatPValue = (value?: number) => {
  if (value == null) return 'N/A';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(4);
};

const csvEscape = (value: string | number | undefined) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { analysisId } = useAnalysisStore();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('adj_p_value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const volcanoPlotRef = useRef<any>(null);
  const heatmapPlotRef = useRef<any>(null);
  const maPlotRef = useRef<any>(null);
  const pcaPlotRef = useRef<any>(null);
  const [pcaView, setPcaView] = useState<'2d' | '3d'>('2d');

  useEffect(() => {
    if (!analysisId) {
      setError('No analysis ID found. Please run an analysis first.');
      setIsLoading(false);
      return;
    }

    let intervalId: NodeJS.Timeout;

    const fetchResults = async () => {
      try {
        const response = await api.degs.results(analysisId);
        const resultData = response.data.data;

        if (resultData.status === 'completed') {
          setData(resultData);
          setIsLoading(false);
          clearInterval(intervalId);
        } else if (resultData.status === 'failed') {
          setError(resultData.error || 'Analysis failed.');
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
    intervalId = setInterval(fetchResults, 3000);

    return () => clearInterval(intervalId);
  }, [analysisId]);

  const handleSort = (key: SortKey) => {
    const nextDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(nextDirection);
    setPage(0);
  };

  if (isLoading) {
    return (
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
          <CircularProgress size={72} thickness={3} sx={{ color: '#6366f1' }} />
          <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScienceIcon sx={{ color: '#6366f1', fontSize: 28 }} />
          </Box>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Running Differential Expression Analysis
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 480, mx: 'auto' }}>
          Computing log-fold changes, applying statistical testing, and generating DEG visualizations...
        </Typography>
        <LinearProgress sx={{
          maxWidth: 380, mx: 'auto', borderRadius: 4,
          '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6366f1, #818cf8)' }
        }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/degs/configure')}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data) return null;

  const summary = data.summary || { total_genes: 0, significant_degs: 0, upregulated: 0, downregulated: 0, analysis_method: 'DESeq2' };
  const results: DEGRow[] = data.results || [];
  const heatmapData: HeatmapRow[] = data.heatmap_data || [];
  const maPlotData: MAPlotRow[] = data.ma_plot_data || [];
  const pcaData = data.pca_data || {};
  const totalSignificantGenes = data.total_significant_genes ?? summary.significant_degs ?? results.length;
  const logfcThreshold = summary.logFC_threshold ?? 1;
  const pvalueThreshold = summary.p_value_threshold ?? 0.05;
  const group1Name = data.group_names?.group1 || 'Control';
  const group2Name = data.group_names?.group2 || 'Treatment';

  const pcaLayout: any =
    pcaView === '2d'
      ? {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',

        font: {
          color: '#9ca3af',
          family: 'Inter, sans-serif'
        },

        xaxis: {
          title: {
            text: `PC1 (${pcaData.pc1_variance?.toFixed(1)}%)`
          },
          gridcolor: 'rgba(255,255,255,0.08)'
        },

        yaxis: {
          title: {
            text: `PC2 (${pcaData.pc2_variance?.toFixed(1)}%)`
          },
          gridcolor: 'rgba(255,255,255,0.08)'
        },

        height: 500,

        legend: {
          orientation: 'h',
          y: 1.08,
          x: 0.5,
          xanchor: 'center'
        },

        margin: {
          t: 40,
          b: 60,
          l: 70,
          r: 20
        }
      }
      : {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',

        font: {
          color: '#9ca3af',
          family: 'Inter, sans-serif'
        },

        scene: {
          xaxis: {
            title: {
              text: `PC1 (${pcaData.pc1_variance?.toFixed(1)}%)`
            }
          },

          yaxis: {
            title: {
              text: `PC2 (${pcaData.pc2_variance?.toFixed(1)}%)`
            }
          },

          zaxis: {
            title: {
              text: `PC3 (${pcaData.pc3_variance?.toFixed(1)}%)`
            }
          }
        },

        height: 650,

        margin: {
          t: 40,
          b: 60,
          l: 20,
          r: 20
        }
      };

  const filteredResults = (() => {
    const query = searchTerm.trim().toLowerCase();
    const visibleRows = query
      ? results.filter((row) => row.gene.toLowerCase().includes(query))
      : results;

    return [...visibleRows].sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'gene') return a.gene.localeCompare(b.gene) * modifier;
      if (sortKey === 'direction') return ((a.logFC > 0 ? 1 : -1) - (b.logFC > 0 ? 1 : -1)) * modifier;

      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return (aValue - bValue) * modifier;
    });
  })();

  const pagedResults = filteredResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const upregulated = results.filter((r) => r.logFC > 0);
  const downregulated = results.filter((r) => r.logFC < 0);

  const downloadTable = (format: 'csv' | 'xls') => {
    const headers = ['Gene', 'log2 Fold Change', 'p-value', 'Adjusted p-value', 'Direction'];
    const rows = filteredResults.map((g) => [
      g.gene,
      g.logFC,
      g.p_value,
      g.adj_p_value ?? '',
      g.logFC > 0 ? 'Upregulated' : 'Downregulated'
    ]);

    const body = [headers, ...rows].map((row) => row.map(csvEscape).join(format === 'csv' ? ',' : '\t')).join('\n');
    const blob = new Blob([body], {
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'csv' ? 'significant_DEGs.csv' : 'significant_DEGs.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllSignificant = async (format: 'csv' | 'xls') => {
    if (!analysisId) return;

    const response = await api.degs.exportResults(analysisId, format);
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'csv' ? 'all_significant_DEGs.csv' : 'all_significant_DEGs.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadVolcanoPlot = (format: 'png' | 'svg') => {
    const graphElement = volcanoPlotRef.current || document.getElementById('deg-volcano-plot');
    if (!graphElement) return;

    PlotlyDownload.downloadImage(graphElement, {
      format,
      filename: 'deg_volcano_plot',
      height: 900,
      width: 1400
    });
  };

  const downloadHeatmapPlot = (format: 'png' | 'svg') => {
    const graphElement = heatmapPlotRef.current || document.getElementById('deg-heatmap-plot');
    if (!graphElement) return;

    PlotlyDownload.downloadImage(graphElement, {
      format,
      filename: 'heatmap',
      height: 1000,
      width: 1200
    });
  };

  const downloadPCAPlot = (format: 'png' | 'svg') => {
    const graphElement =
      pcaPlotRef.current ||
      document.getElementById('deg-pca-plot');

    if (!graphElement) return;

    PlotlyDownload.downloadImage(graphElement, {
      format,
      filename: 'deg_pca_plot',
      height: 900,
      width: 1400
    });
  };

  const downloadMAPlot = (format: 'png' | 'svg') => {
    const graphElement =
      maPlotRef.current ||
      document.getElementById('deg-ma-plot');

    if (!graphElement) return;

    PlotlyDownload.downloadImage(graphElement, {
      format,
      filename: 'deg_ma_plot',
      height: 900,
      width: 1400
    });
  };

  const makeTrace = (pts: DEGRow[], color: string, name: string, size = 7) => ({
    x: pts.map((r) => r.logFC),
    y: pts.map((r) => -Math.log10(Math.max(r.p_value, 1e-300))),
    type: 'scatter',
    mode: 'markers',
    name,
    text: pts.map((r) => r.gene),
    hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.3f} [log2(mean+1)]<extra></extra>',
    marker: { color, opacity: 0.82, size },
  });

  const plotData = [
    makeTrace(downregulated, '#2563eb', `Downregulated (${downregulated.length})`, 8),
    makeTrace(upregulated, '#dc2626', `Upregulated (${upregulated.length})`, 8),
  ];

  const volcanoYValues = results.map((r) => -Math.log10(Math.max(r.p_value, 1e-300)));
  const maxY = Math.max(...volcanoYValues, -Math.log10(pvalueThreshold), 10);
  const maxAbsLogFC = Math.max(...results.map((r) => Math.abs(r.logFC)), logfcThreshold, 2);
  const xRange = [-Math.ceil(maxAbsLogFC + 0.5), Math.ceil(maxAbsLogFC + 0.5)];

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            DEG Analysis Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Method: <strong style={{ color: '#818cf8' }}>{summary.analysis_method}</strong>
            {' · '}
            {summary.significant_degs?.toLocaleString()} significant genes (|log2FC| &gt; {logfcThreshold}, p &lt; {pvalueThreshold})
          </Typography>
        </Box>
        <Chip
          label="Analysis Complete"
          color="success"
          sx={{ fontWeight: 700, px: 2, fontSize: '0.85rem', height: 34 }}
        />
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #6366f1' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Total Genes Tested</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {summary.total_genes.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #818cf8' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Significant DEGs</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, color: '#818cf8' }}>
                {summary.significant_degs.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #dc2626' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Upregulated</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#dc2626' }} />
                <Typography variant="h3" sx={{ fontWeight: 800, color: 'error.main' }}>
                  {summary.upregulated.toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid #2563eb' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Downregulated</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon sx={{ color: '#2563eb' }} />
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#2563eb' }}>
                  {summary.downregulated.toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            aria-label="DEG results tabs"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 500,
                textTransform: 'uppercase',
              }
            }}
          >
            <Tab label="DEG Table" />
            <Tab label="Visualizations" />
          </Tabs>
        </Box>

        {activeTab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Significant DEG Table
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Showing top {results.length.toLocaleString()} of {totalSignificantGenes.toLocaleString()} significant genes
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  size="small"
                  placeholder="Search gene"
                  value={searchTerm}
                  onChange={(event) => { setSearchTerm(event.target.value); setPage(0); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadTable('csv')}>
                  Top CSV
                </Button>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadTable('xls')}>
                  Top Excel
                </Button>
                <Button variant="contained" size="small" startIcon={<DownloadIcon />} onClick={() => downloadAllSignificant('csv')}>
                  All CSV
                </Button>
                <Button variant="contained" size="small" startIcon={<DownloadIcon />} onClick={() => downloadAllSignificant('xls')}>
                  All Excel
                </Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    {[
                      ['gene', 'Gene'],
                      ['logFC', 'log2 Fold Change'],
                      ['p_value', 'p-value'],
                      ['adj_p_value', 'Adjusted p-value'],
                      ['direction', 'Direction']
                    ].map(([key, label]) => (
                      <TableCell key={key} sx={{ fontWeight: 700 }}>
                        <TableSortLabel
                          active={sortKey === key}
                          direction={sortKey === key ? sortDirection : 'asc'}
                          onClick={() => handleSort(key as SortKey)}
                        >
                          {label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedResults.map((row) => (
                    <TableRow key={row.gene} hover>
                      <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.gene}</TableCell>
                      <TableCell sx={{ color: row.logFC > 0 ? '#dc2626' : '#2563eb', fontWeight: 600 }}>
                        {row.logFC > 0 ? '+' : ''}{row.logFC.toFixed(3)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {formatPValue(row.p_value)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {formatPValue(row.adj_p_value)}
                      </TableCell>
                      <TableCell>
                        {row.logFC > 0
                          ? <Chip label="Up" size="small" sx={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.7rem', height: 22 }} />
                          : <Chip label="Down" size="small" sx={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)', fontSize: '0.7rem', height: 22 }} />
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                        No significant DEGs match the current search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[15, 25, 50, 100]}
              component="div"
              count={filteredResults.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          </CardContent>
        )}

        {activeTab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ mb: 5 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Volcano Plot</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Showing top {results.length.toLocaleString()} significant genes out of {totalSignificantGenes.toLocaleString()} total significant genes.
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadVolcanoPlot('png')}>
                    PNG
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadVolcanoPlot('svg')}>
                    SVG
                  </Button>
                </Stack>
              </Stack>
              <Box sx={{ backgroundColor: 'rgba(2,6,23,0.22)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <Plot
                  divId="deg-volcano-plot"
                  onInitialized={(_, graphDiv) => { volcanoPlotRef.current = graphDiv; }}
                  onUpdate={(_, graphDiv) => { volcanoPlotRef.current = graphDiv; }}
                  data={plotData as any}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                    xaxis: {
                      title: { text: 'log2 Fold Change', font: { color: '#6b7280' } },
                      gridcolor: 'rgba(255,255,255,0.07)',
                      zerolinecolor: 'rgba(255,255,255,0.18)',
                      range: xRange,
                      tickfont: { size: 11 },
                    },
                    yaxis: {
                      title: { text: '-log10(p-value)', font: { color: '#6b7280' } },
                      gridcolor: 'rgba(255,255,255,0.07)',
                      tickfont: { size: 11 },
                    },
                    hovermode: 'closest',
                    autosize: true,
                    legend: {
                      orientation: 'h',
                      y: 1.1,
                      x: 1,
                      xanchor: 'right',
                      bgcolor: 'rgba(17,24,39,0.86)',
                      bordercolor: 'rgba(255,255,255,0.12)',
                      borderwidth: 1,
                      font: { color: '#d1d5db', size: 12 }
                    },
                    shapes: [
                      { type: 'line', x0: logfcThreshold, x1: logfcThreshold, y0: 0, y1: maxY, line: { color: 'rgba(220,38,38,0.55)', dash: 'dash', width: 1.5 } },
                      { type: 'line', x0: -logfcThreshold, x1: -logfcThreshold, y0: 0, y1: maxY, line: { color: 'rgba(37,99,235,0.55)', dash: 'dash', width: 1.5 } },
                      { type: 'line', x0: xRange[0], x1: xRange[1], y0: -Math.log10(pvalueThreshold), y1: -Math.log10(pvalueThreshold), line: { color: 'rgba(99,102,241,0.55)', dash: 'dot', width: 1.5 } },
                    ],
                    height: 460,
                    margin: { t: 20, b: 55, l: 65, r: 25 },
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToAdd: ['resetScale2d'],
                    toImageButtonOptions: {
                      format: 'png',
                      filename: 'deg_volcano_plot',
                      height: 900,
                      width: 1400,
                      scale: 2
                    }
                  }}
                  useResizeHandler
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Box>

            <Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Heatmap</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Top 10 upregulated and top 10 downregulated genes ranked by log2 fold change.
                    Colors represent log2(mean expression + 1) levels across groups.
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadHeatmapPlot('png')}>
                    PNG
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadHeatmapPlot('svg')}>
                    SVG
                  </Button>
                </Stack>
              </Stack>
              <Box sx={{ backgroundColor: 'rgba(2,6,23,0.22)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <Plot
                  divId="deg-heatmap-plot"
                  onInitialized={(_, graphDiv) => { heatmapPlotRef.current = graphDiv; }}
                  onUpdate={(_, graphDiv) => { heatmapPlotRef.current = graphDiv; }}
                  data={[
                    {
                      z: heatmapData.map((row) => [
                        Math.log2(row.group1 + 1),
                        Math.log2(row.group2 + 1)
                      ]),
                      x: [group1Name, group2Name],
                      y: heatmapData.map((row) => row.gene),
                      type: 'heatmap',
                      colorscale: [
                        [0, '#2563eb'],
                        [0.5, '#f8fafc'],
                        [1, '#dc2626']
                      ],
                      colorbar: {
                        title: {
                          text: 'log2(mean expression + 1)',
                          side: 'right'
                        },
                        thickness: 14
                      },
                      hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.3f}<extra></extra>'
                    }
                  ] as any}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                    xaxis: {
                      side: 'top',
                      tickfont: { size: 12 },
                      gridcolor: 'rgba(255,255,255,0.08)'
                    },
                    yaxis: {
                      automargin: true,
                      autorange: 'reversed',
                      tickfont: { size: 11 },
                    },
                    autosize: true,
                    height: Math.max(420, heatmapData.length * 24 + 170),
                    margin: { t: 75, b: 35, l: 115, r: 85 },
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    toImageButtonOptions: {
                      format: 'png',
                      filename: 'deg_top_genes_heatmap',
                      height: 900,
                      width: 1200,
                      scale: 2
                    }
                  }}
                  useResizeHandler
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Box>

            <Box sx={{ mt: 4 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ mb: 2 }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    PCA Plot
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Principal component analysis of all samples.
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems="center"
                >
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={pcaView}
                    onChange={(_, value) => {
                      if (value) setPcaView(value);
                    }}
                  >
                    <ToggleButton value="2d">
                      2D PCA
                    </ToggleButton>

                    <ToggleButton value="3d">
                      3D PCA
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadPCAPlot('png')}
                  >
                    PNG
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadPCAPlot('svg')}
                  >
                    SVG
                  </Button>
                </Stack>
              </Stack>

              <Box sx={{ backgroundColor: 'rgba(2,6,23,0.22)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <Plot
                  divId="deg-pca-plot"
                  onInitialized={(_, graphDiv) => {
                    pcaPlotRef.current = graphDiv;
                  }}
                  onUpdate={(_, graphDiv) => {
                    pcaPlotRef.current = graphDiv;
                  }}
                  data={[
                    {
                      x: pcaData.samples
                        ?.filter((s: any) => s.group === group1Name)
                        .map((s: any) => s.pc1),

                      y: pcaData.samples
                        ?.filter((s: any) => s.group === group1Name)
                        .map((s: any) => s.pc2),

                      z: pcaData.samples
                        ?.filter((s: any) => s.group === group1Name)
                        .map((s: any) => s.pc3),

                      text: pcaData.samples
                        ?.filter((s: any) => s.group === group1Name)
                        .map((s: any) => s.sample),

                      mode: 'markers',

                      type: pcaView === '3d'
                        ? 'scatter3d'
                        : 'scatter',

                      name: group1Name,

                      marker: {
                        size: 10,
                        color: '#2563eb'
                      }
                    },

                    {
                      x: pcaData.samples
                        ?.filter((s: any) => s.group === group2Name)
                        .map((s: any) => s.pc1),

                      y: pcaData.samples
                        ?.filter((s: any) => s.group === group2Name)
                        .map((s: any) => s.pc2),

                      z: pcaData.samples
                        ?.filter((s: any) => s.group === group2Name)
                        .map((s: any) => s.pc3),

                      text: pcaData.samples
                        ?.filter((s: any) => s.group === group2Name)
                        .map((s: any) => s.sample),

                      mode: 'markers',

                      type: pcaView === '3d'
                        ? 'scatter3d'
                        : 'scatter',

                      name: group2Name,

                      marker: {
                        size: 10,
                        color: '#dc2626'
                      }
                    }
                  ] as any}
                  layout={pcaLayout}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false
                  }}
                  useResizeHandler
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Box>

            <Box sx={{ mt: 4 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    MA Plot
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mean expression versus log2 fold change for significant genes.
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadMAPlot('png')}>
                    PNG
                  </Button>

                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadMAPlot('svg')}>
                    SVG
                  </Button>
                </Stack>
              </Stack>
              <Box sx={{ backgroundColor: 'rgba(2,6,23,0.22)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <Plot
                  divId="deg-ma-plot"
                  onInitialized={(_, graphDiv) => {
                    maPlotRef.current = graphDiv;
                  }}
                  onUpdate={(_, graphDiv) => {
                    maPlotRef.current = graphDiv;
                  }}
                  data={[
                    {
                      x: maPlotData.map((g) => g.A),
                      y: maPlotData.map((g) => g.logFC),
                      text: maPlotData.map((g) => g.gene),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        size: 7,
                        color: maPlotData.map((g) =>
                          g.significant ? '#dc2626' : '#94a3b8'
                        ),
                        opacity: 0.75
                      },
                      hovertemplate:
                        '<b>%{text}</b><br>' +
                        'Mean Expression: %{x:.2f}<br>' +
                        'logFC: %{y:.2f}<extra></extra>'
                    }
                  ] as any}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: {
                      color: '#9ca3af',
                      family: 'Inter, sans-serif'
                    },
                    xaxis: {
                      title: {
                        text: 'Mean Expression (log2)'
                      },
                      gridcolor: 'rgba(255,255,255,0.08)'
                    },
                    yaxis: {
                      title: {
                        text: 'log2 Fold Change'
                      },
                      gridcolor: 'rgba(255,255,255,0.08)',
                      zeroline: true,
                      zerolinecolor: '#475569'
                    },
                    height: 500,
                    margin: {
                      t: 40,
                      b: 60,
                      l: 70,
                      r: 20
                    }
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false
                  }}
                  useResizeHandler
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            </Box>
          </CardContent>
        )}
      </Card>
    </Box >
  );
};

export default ResultsPage;
