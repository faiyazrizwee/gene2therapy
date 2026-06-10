import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Box, Typography, Button, FormControl, Select, MenuItem, InputLabel, TextField, IconButton, Tooltip, Stack, Card, CardContent } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import SearchIcon from '@mui/icons-material/Search';

interface CytoscapeNetworkProps {
  elements: cytoscape.ElementDefinition[];
  title?: string;
  subtitle?: string;
}

export const CytoscapeNetwork: React.FC<CytoscapeNetworkProps> = ({ elements, title, subtitle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [layoutName, setLayoutName] = useState<string>('cose');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hoveredNode, setHoveredNode] = useState<{ label: string; type: string; degree: number; id: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    // Create cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: true,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(displayLabel)',
            'font-family': 'Inter, system-ui, sans-serif',
            'font-size': '11px',
            'font-weight': 'bold',
            'color': '#f8fafc',
            'text-valign': 'bottom',
            'text-margin-y': 2,
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'background-color': '#3b82f6',
            'border-width': '2px',
            'border-color': '#ffffff',
            'overlay-color': '#6366f1',
            'overlay-opacity': 0.2,
            'transition-property': 'background-color, border-color, width, height, opacity',
            'transition-duration': 0.25,
          }
        },
        {
          selector: 'node[type="gene"]',
          style: {
            'background-color': '#3b82f6', // blue
            'shape': 'ellipse',
            'width': '20px',
            'height': '20px',
          }
        },
        {
          selector: 'node[type="pathway"]',
          style: {
            'background-color': '#10b981', // green
            'shape': 'diamond',
            'width': '28px',
            'height': '28px',
          }
        },
        {
          selector: 'node[type="disease"]',
          style: {
            'background-color': '#f43f5e', // red
            'shape': 'hexagon',
            'width': '26px',
            'height': '26px',
          }
        },
        {
          selector: 'node[type="drug"]',
          style: {
            'background-color': '#f59e0b', // orange
            'shape': 'rectangle',
            'width': '24px',
            'height': '24px',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': 'rgba(148, 163, 184, 0.3)',
            'curve-style': 'bezier',
            'overlay-color': '#6366f1',
            'overlay-opacity': 0.2,
            'transition-property': 'line-color, width, opacity',
            'transition-duration': 0.25,
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': '4px',
            'border-color': '#6366f1',
          }
        },
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.15,
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#6366f1',
            'width': 3,
            'opacity': 1.0,
          }
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.05,
          }
        }
      ],
        layout: {
          name: layoutName,
          animate: true,
          animationDuration: 500,
          padding: 80,
          nodeRepulsion: 400000,
          idealEdgeLength: 180,
          edgeElasticity: 50,
          nestingFactor: 1.2,
          gravity: 0.4,
          spacingFactor: 2.0
        } as any
    });

    cyRef.current = cy;

    cy.nodes().forEach((node) => {
      const degree = node.degree(false);
      node.data('degree', degree);
      node.data('displayLabel', node.data('label') || node.id());
    });

    // Interactive hovering / clicking highlighting
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const neighborhood = node.neighborhood().add(node);

      cy.nodes().addClass('dimmed').removeClass('highlighted');
      cy.edges().addClass('dimmed').removeClass('highlighted');
      neighborhood.removeClass('dimmed').addClass('highlighted');
      node.connectedEdges().removeClass('dimmed').addClass('highlighted');

      setHoveredNode({
        id: node.id(),
        label: node.data('fullLabel') || node.data('label') || node.id(),
        type: node.data('type') || 'node',
        degree: node.data('degree') || node.degree(false),
      });
    });

    cy.on('mouseout', 'node', () => {
      setHoveredNode(null);
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const neighborhood = node.neighborhood().add(node);
      
      cy.nodes().addClass('dimmed').removeClass('highlighted');
      cy.edges().addClass('dimmed').removeClass('highlighted');

      neighborhood.removeClass('dimmed').addClass('highlighted');
      node.connectedEdges().removeClass('dimmed').addClass('highlighted');
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.nodes().removeClass('dimmed').removeClass('highlighted');
        cy.edges().removeClass('dimmed').removeClass('highlighted');
      }
    });

    return () => {
      cy.destroy();
      };
    }, [elements]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    const layout = cy.layout({
      name: layoutName,
      animate: true,
      animationDuration: 500,
      padding: 80,
      nodeRepulsion: 400000,
      idealEdgeLength: 180,
      edgeElasticity: 50,
      nestingFactor: 1.2,
      gravity: 0.4,
      spacingFactor: 2.0
    } as any);

    layout.run();

    setTimeout(() => {
      if (cy && !cy.destroyed()) cy.fit(undefined, 80);
    }, 600);

  }, [layoutName]);


  // Handle live search filter
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    if (!searchTerm.trim()) {
      cy.nodes().removeClass('dimmed').removeClass('highlighted');
      cy.edges().removeClass('dimmed').removeClass('highlighted');
      return;
    }

    const query = searchTerm.toLowerCase().trim();
    cy.nodes().each((node) => {
      const label = (node.data('label') || '').toLowerCase();
      if (label.includes(query)) {
        node.removeClass('dimmed').addClass('highlighted');
        // highlight its edges
        node.connectedEdges().removeClass('dimmed').addClass('highlighted');
      } else {
        node.addClass('dimmed').removeClass('highlighted');
      }
    });
  }, [searchTerm]);

  const handleZoomIn = () => {
    cyRef.current?.zoom({
      level: (cyRef.current.zoom() || 1) * 1.25,
      position: { x: cyRef.current.width()! / 2, y: cyRef.current.height()! / 2 }
    });
  };

  const handleZoomOut = () => {
    cyRef.current?.zoom({
      level: (cyRef.current.zoom() || 1) / 1.25,
      position: { x: cyRef.current.width()! / 2, y: cyRef.current.height()! / 2 }
    });
  };

  const handleFit = () => {
    cyRef.current?.fit();
  };

  const handleExportPNG = () => {
    if (!cyRef.current) return;
    const png64 = cyRef.current.png({ full: true, scale: 2 });
    const link = document.createElement('a');
    link.href = png64;
    link.download = `network_${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!cyRef.current) return;
    const jsonStr = JSON.stringify(cyRef.current.json(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSVG = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const extent = cy.extent();
    const width = extent.w + 100;
    const height = extent.h + 100;
    const minX = extent.x1 - 50;
    const minY = extent.y1 - 50;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`;
    svgContent += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#0f172a" />`;

    // Draw edges
    cy.edges().forEach((edge) => {
      const sourcePos = edge.source().position();
      const targetPos = edge.target().position();
      svgContent += `<line x1="${sourcePos.x}" y1="${sourcePos.y}" x2="${targetPos.x}" y2="${targetPos.y}" stroke="#94a3b8" stroke-opacity="0.3" stroke-width="1.5" />`;
    });

    // Draw nodes
    cy.nodes().forEach((node) => {
      const pos = node.position();
      const type = node.data('type');
      const label = node.data('label') || '';

      let color = '#3b82f6';
      if (type === 'pathway') color = '#10b981';
      if (type === 'disease') color = '#f43f5e';
      if (type === 'drug') color = '#f59e0b';

      if (type === 'pathway') {
        const size = 28;
        const pts = `${pos.x},${pos.y - size/2} ${pos.x + size/2},${pos.y} ${pos.x},${pos.y + size/2} ${pos.x - size/2},${pos.y}`;
        svgContent += `<polygon points="${pts}" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`;
      } else if (type === 'disease') {
        const size = 26;
        const r = size / 2;
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * 2 * Math.PI) / 6;
          pts.push(`${pos.x + r * Math.cos(angle)},${pos.y + r * Math.sin(angle)}`);
        }
        svgContent += `<polygon points="${pts.join(' ')}" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`;
      } else if (type === 'drug') {
        const size = 24;
        svgContent += `<rect x="${pos.x - size/2}" y="${pos.y - size/2}" width="${size}" height="${size}" fill="${color}" stroke="#ffffff" stroke-width="1.5" rx="3" />`;
      } else {
        const size = 20;
        svgContent += `<circle cx="${pos.x}" cy="${pos.y}" r="${size/2}" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`;
      }

      const cleanLabel = label.replace(/[<>&'"]/g, (c: string) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
      svgContent += `<text x="${pos.x}" y="${pos.y + 22}" fill="#e2e8f0" font-family="Inter, sans-serif" font-size="10px" text-anchor="middle">${cleanLabel}</text>`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_${new Date().getTime()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            {title && (
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#818cf8' }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Box */}
            <TextField
              size="small"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 20 }} />,
              }}
              sx={{ width: 180, '& .MuiInputBase-root': { height: 40 } }}
            />
            {/* Layout selector */}
            <FormControl size="small" sx={{ width: 140 }}>
              <InputLabel>Layout</InputLabel>
              <Select
                value={layoutName}
                label="Layout"
                onChange={(e) => setLayoutName(e.target.value)}
                sx={{ height: 40 }}
              >
                <MenuItem value="cose">Force Directed</MenuItem>
                <MenuItem value="concentric">Concentric</MenuItem>
                <MenuItem value="breadthfirst">Breadth First</MenuItem>
                <MenuItem value="circle">Circle</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Legend */}
        <Stack direction="row" spacing={2.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#3b82f6', border: '1px solid #fff' }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Gene</Typography>
          </Stack>
            {!elements.some((e: any) => e.data?.type === "drug" || e.data?.type === "disease") && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 12, height: 12, transform: "rotate(45deg)", bgcolor: "#10b981", border: "1px solid #fff" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Pathway</Typography>
              </Stack>
            )}

          {elements.some((e: any) => e.data?.type === 'disease') && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 12, height: 12, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', bgcolor: '#f43f5e', border: '1px solid #fff' }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>Disease</Typography>
            </Stack>
          )}
          {elements.some((e: any) => e.data?.type === 'drug') && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#f59e0b', border: '1px solid #fff' }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>Drug</Typography>
            </Stack>
          )}
        </Stack>

        {/* Interactive Canvas */}
        <Box sx={{ position: 'relative', flexGrow: 1, minHeight: 700, bgcolor: 'rgba(15, 23, 42, 0.4)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
          {hoveredNode && (
            <Box sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              maxWidth: 280,
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 18px 60px rgba(0,0,0,0.32)',
              backdropFilter: 'blur(8px)'
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 800 }}>
                {hoveredNode.type} node
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, mt: 0.5 }}>
                {hoveredNode.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                ID: {hoveredNode.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Degree: {hoveredNode.degree}
              </Typography>
            </Box>
          )}
          
          {/* Zoom Control Overlay */}
          <Stack spacing={1} sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
            <Tooltip title="Zoom In" placement="left">
              <IconButton onClick={handleZoomIn} sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'text.primary', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out" placement="left">
              <IconButton onClick={handleZoomOut} sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'text.primary', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit View" placement="left">
              <IconButton onClick={handleFit} sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'text.primary', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}>
                <CenterFocusWeakIcon />
              </IconButton>
            </Tooltip>
          </Stack>

            {/* Export Controls */}
            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-start", flexWrap: "wrap" }}>
            <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<ImageIcon />}
              onClick={handleExportPNG}
              sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}
            >
              PNG
            </Button>
            <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<IconButton size="small" sx={{ p: 0, color: 'inherit' }}><CenterFocusWeakIcon sx={{ fontSize: 16 }} /></IconButton>}
              onClick={handleExportSVG}
              sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}
            >
              SVG
            </Button>
            <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<CodeIcon />}
              onClick={handleExportJSON}
              sx={{ bgcolor: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(30, 41, 59, 1)' } }}
            >
              JSON
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CytoscapeNetwork;
