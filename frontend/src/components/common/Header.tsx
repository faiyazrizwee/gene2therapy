import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import ScienceIcon from '@mui/icons-material/Science';
import HubIcon from '@mui/icons-material/Hub';
import HomeIcon from '@mui/icons-material/Home';

const Header: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  const isDegsActive = path.startsWith('/degs');
  const isPathwayActive = path.startsWith('/pathway');

  const navItems = [
    {
      to: '/',
      label: 'Home',
      icon: <HomeIcon sx={{ fontSize: 18 }} />,
      isActive: path === '/',
      activeColor: '#818cf8',
      activeBg: 'rgba(99, 102, 241, 0.1)',
    },
    {
      to: '/degs/upload',
      label: 'DEG Analyzer',
      icon: <ScienceIcon sx={{ fontSize: 18 }} />,
      isActive: isDegsActive,
      activeColor: '#818cf8',
      activeBg: 'rgba(99, 102, 241, 0.1)',
    },
    {
      to: '/pathway',
      label: 'Pathway & Drugs',
      icon: <HubIcon sx={{ fontSize: 18 }} />,
      isActive: isPathwayActive,
      activeColor: '#34d399',
      activeBg: 'rgba(16, 185, 129, 0.1)',
    },
  ];

  return (
    <AppBar position="sticky" sx={{ mb: 4 }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>

          {/* ── Logo ── */}
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              gap: 1.5,
              '&:hover .logo-icon': {
                transform: 'rotate(-8deg) scale(1.05)',
              },
            }}
          >
            {/* Icon badge */}
            <Box
              className="logo-icon"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                boxShadow: '0 0 16px rgba(99,102,241,0.35)',
                transition: 'transform 0.25s ease',
                flexShrink: 0,
              }}
            >
              <ScienceIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>

            {/* Logo wordmark — split into 3 spans so each can have its own color */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <Typography
                component="span"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Gene
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  mx: '1px',
                  background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                2
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Therapy
              </Typography>
            </Box>
          </Box>

          {/* ── Navigation ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={Link}
                to={item.to}
                startIcon={item.icon}
                sx={{
                  fontWeight: item.isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  color: item.isActive ? item.activeColor : 'text.secondary',
                  background: item.isActive ? item.activeBg : 'transparent',
                  border: item.isActive ? `1px solid ${item.activeColor}33` : '1px solid transparent',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.75,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: item.isActive ? item.activeBg : 'rgba(255, 255, 255, 0.05)',
                    color: item.isActive ? item.activeColor : '#e2e8f0',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;
