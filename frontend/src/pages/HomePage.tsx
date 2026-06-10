import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Button, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ScienceIcon from '@mui/icons-material/Science';
import HubIcon from '@mui/icons-material/Hub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MedicationIcon from '@mui/icons-material/Medication';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ py: 4 }}>
      {/* Hero Section */}
      <Box sx={{ mb: 8, textAlign: 'center', position: 'relative' }}>
        {/* Background glow */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.06) 50%, transparent 70%)',
            filter: 'blur(60px)',
            zIndex: -1,
          }}
        />

        <Typography
          variant="h2"
          gutterBottom
          sx={{
            fontSize: { xs: '2.2rem', md: '3.75rem' },
            fontWeight: 800,
            background: 'linear-gradient(135deg, #a5b4fc 0%, #6366f1 50%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 2,
          }}
        >
          Gene-to-Therapy Discovery Platform
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', fontWeight: 400, px: 2, mb: 5 }}>
          Accelerate your genomic workflow. Run differential expression analysis or map gene signatures
          directly to therapeutic pathways and clinical drug candidates.
        </Typography>

        {/* Floating stats row */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap', mb: 2 }}>
          {[
            { icon: <ScienceIcon sx={{ fontSize: 18 }} />, label: '3 Databases', sublabel: 'NCBI · KEGG · Open Targets', color: '#6366f1' },
            { icon: <AccountTreeIcon sx={{ fontSize: 18 }} />, label: '350+ Pathways', sublabel: 'KEGG human pathway maps', color: '#3b82f6' },
            { icon: <MedicationIcon sx={{ fontSize: 18 }} />, label: 'FDA Drug Data', sublabel: 'Phase I–IV clinical matches', color: '#10b981' },
          ].map((stat, i) => (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.5,
              borderRadius: 3,
              background: `${stat.color}0d`,
              border: `1px solid ${stat.color}22`,
              color: stat.color
            }}>
              {stat.icon}
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>{stat.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{stat.sublabel}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main Grid Options */}
      <Grid container spacing={4} justifyContent="center">
        {/* Tool 1 Card */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-6px)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                boxShadow: '0 12px 40px 0 rgba(99, 102, 241, 0.15)',
              },
            }}
          >
            <CardContent sx={{ p: 4, flexGrow: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: 'primary.main',
                  mb: 3,
                }}
              >
                <ScienceIcon sx={{ fontSize: 32 }} />
              </Box>

              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                Differential Expression (DEGs)
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Compare transcription counts between custom experimental cohorts. Run standard pipeline models
                (DESeq2 or normalized t-test) to isolate up- and down-regulated gene signatures,
                visualized instantly on interactive Volcano Plots.
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 3 }}>
                {['DESeq2', 't-test', 'Volcano Plot', 'CSV/TSV'].map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.7rem', height: 22, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }} />
                ))}
              </Box>
            </CardContent>

            <Box sx={{ p: 4, pt: 0 }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/degs/upload')}
              >
                Launch DEG Analyzer
              </Button>
            </Box>
          </Card>
        </Grid>

        {/* Tool 2 Card */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-6px)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                boxShadow: '0 12px 40px 0 rgba(16, 185, 129, 0.15)',
              },
            }}
          >
            <CardContent sx={{ p: 4, flexGrow: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: 'secondary.main',
                  mb: 3,
                }}
              >
                <HubIcon sx={{ fontSize: 32 }} />
              </Box>

              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                Pathway & Drug Discovery
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Input gene lists to execute complete pathway enrichment and clinical therapeutic matching.
                Queries biological definitions from NCBI, maps pathways via KEGG, and gathers target-specific
                drug candidates from Open Targets.
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 3 }}>
                {['NCBI Entrez', 'KEGG API', 'Open Targets', 'NetworkX', 'Plotly'].map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.7rem', height: 22, background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }} />
                ))}
              </Box>
            </CardContent>

            <Box sx={{ p: 4, pt: 0 }}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/pathway')}
              >
                Launch Pathway Discovery
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HomePage;
