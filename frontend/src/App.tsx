import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Container, Box, Typography } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import theme from './theme/muiTheme';

import Header from './components/common/Header';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ConfigurePage from './pages/ConfigurePage';
import ResultsPage from './pages/ResultsPage';
import PathwayInputPage from './pages/PathwayInputPage';
import PathwayResultsPage from './pages/PathwayResultsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#0b0f19' }}>
            <Header />
            <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/degs/upload" element={<UploadPage />} />
                <Route path="/degs/configure" element={<ConfigurePage />} />
                <Route path="/degs/results" element={<ResultsPage />} />
                <Route path="/pathway" element={<PathwayInputPage />} />
                <Route path="/pathway/results" element={<PathwayResultsPage />} />
              </Routes>
            </Container>
            
            {/* Footer */}
            <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
              <Container maxWidth="lg">
                <Typography variant="body2" color="text.secondary" align="center">
                  {'© '}
                  {new Date().getFullYear()}
                  {' Gene2Therapy. Integrated Genomic Analysis & Drug Discovery Portal.'}
                </Typography>
              </Container>
            </Box>
          </Box>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
