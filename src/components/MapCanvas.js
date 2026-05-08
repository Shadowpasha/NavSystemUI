import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

// --- Styled Components ---

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
`;

const CanvasWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #2b2b2b;
`;

const StyledCanvas = styled.canvas`
  cursor: ${props => props.isPanning ? 'grab' : 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><line x1="10" y1="0" x2="10" y2="20" stroke="black" stroke-width="2"/><line x1="0" y1="10" x2="20" y2="10" stroke="black" stroke-width="2"/></svg>\') 10 10, crosshair'};
  display: block;
`;

const StatusOverlay = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #111827;
`;

const PulseIndicator = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: #3b82f6;
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
`;

const ControlsOverlay = styled.div`
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #4b5563;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #f3f4f6;
  text-align: right;
  line-height: 1.5;
`;

const MapCanvas = ({
  mapData,
  odom,
  scan,
  path,
  markers,
  subGoal,
  onGoalSelect,
  width = 800,
  height = 800
}) => {
  const canvasRef = useRef(null);

  // Goal dragging state
  const [goalPreview, setGoalPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Pan and Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0, init: false });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [isHeadingUp, setIsHeadingUp] = useState(true);

  const COLORS = {
    FREE: '#dcdcdc',
    OCCUPIED: '#000000',
    UNKNOWN: '#708090',
    INFLATION: 'rgba(239, 68, 68, 0.15)',
    ROBOT: '#cbd5e1',
    PATH: '#10b981',
    SCAN: '#ef4444',
    GOAL: '#000000'
  };

  // Initialize pan to center map once map loads
  useEffect(() => {
    if (mapData && !pan.init && width > 0 && height > 0) {
      const { info } = mapData;
      const baseScale = Math.min(width / info.width, height / info.height);
      setPan({
        x: (width - info.width * baseScale) / 2,
        y: (height - info.height * baseScale) / 2,
        init: true
      });
    }
  }, [mapData, width, height, pan.init]);

  // Handle Wheel Event manually to prevent scrolling the page (though we are hidden)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (!mapData || !pan.init) return;

      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(zoom * zoomFactor, 20));

      const { info } = mapData;
      const baseScale = Math.min(width / info.width, height / info.height);
      const oldCurrentScale = baseScale * zoom;
      const newCurrentScale = baseScale * newZoom;

      let mapX, mapY;

      if (isHeadingUp && odom) {
        // In Heading Up mode, we zoom relative to the robot's position on screen (usually center)
        // or just zoom relative to the mouse but it's complex. 
        // Simplest: zoom relative to screen center if follow mode is active.
        const angle = odom.yaw - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Screen to Unrotated Canvas
        const dx = cx - width / 2;
        const dy = cy - height / 2;
        const ux = (dx * cos + dy * sin) + (odom.x - info.origin.position.x) / info.resolution * oldCurrentScale + pan.x;
        const uy = (dx * -sin + dy * cos) + (height - (odom.y - info.origin.position.y) / info.resolution * oldCurrentScale - (height - pan.y));
        // This is getting complicated. Let's just zoom and keep the robot centered if heading up.
      }

      const mapX_old = (cx - pan.x) / oldCurrentScale;
      const mapY_old = (height - cy - pan.y) / oldCurrentScale;

      const newPanX = cx - mapX_old * newCurrentScale;
      const newPanY = height - cy - mapY_old * newCurrentScale;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY, init: true });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoom, pan, mapData, width, height]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, width, height);

    if (!mapData || !pan.init) {
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Waiting for map data...', width / 2, height / 2);
      return;
    }

    const { info, data } = mapData;
    const { resolution, width: mWidth, height: mHeight, origin } = info;

    const baseScale = Math.min(width / mWidth, height / mHeight);
    const currentScale = baseScale * zoom;

    const toCanvasX = (wx) => {
      const gx = (wx - origin.position.x) / resolution;
      return gx * currentScale + pan.x;
    };
    const toCanvasY = (wy) => {
      const gy = (wy - origin.position.y) / resolution;
      return height - (gy * currentScale + pan.y);
    };

    // Rotation angle: we want robot's odom.yaw to be screen "Up" (-PI/2 in canvas)
    // Map's ROS X (0 yaw) is screen "Right" (0 in canvas)
    const rotationAngle = (odom && isHeadingUp) ? odom.yaw - Math.PI / 2 : 0;
    const rx = odom ? toCanvasX(odom.x) : 0;
    const ry = odom ? toCanvasY(odom.y) : 0;

    const applyTransform = () => {
      if (isHeadingUp && odom) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate(rotationAngle);
        ctx.translate(-rx, -ry);
      }
    };

    ctx.save();
    applyTransform();

    // Draw 1-Meter Grid
    const minWx = (0 - pan.x) / currentScale * resolution + origin.position.x;
    const maxWx = (width - pan.x) / currentScale * resolution + origin.position.x;

    // minWy occurs at cy = height, maxWy occurs at cy = 0
    const minWy = (height - height - pan.y) / currentScale * resolution + origin.position.y;
    const maxWy = (height - 0 - pan.y) / currentScale * resolution + origin.position.y;

    const startX = Math.floor(minWx - 10); // Buffer for rotation
    const endX = Math.ceil(maxWx + 10);
    const startY = Math.floor(minWy - 10);
    const endY = Math.ceil(maxWy + 10);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
      const cx = Math.floor(toCanvasX(x)) + 0.5;
      ctx.moveTo(cx, startY * currentScale / resolution); // Simplified grid lines
      ctx.lineTo(cx, endY * currentScale / resolution);
      // Wait, the grid drawing was simpler before. Let's stick to it but ensure it covers rotated area.
    }
    // Re-writing grid to be more robust for rotation
    ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
        const cx = toCanvasX(x);
        ctx.moveTo(cx, toCanvasY(startY));
        ctx.lineTo(cx, toCanvasY(endY));
    }
    for (let y = startY; y <= endY; y++) {
        const cy = toCanvasY(y);
        ctx.moveTo(toCanvasX(startX), cy);
        ctx.lineTo(toCanvasX(endX), cy);
    }
    ctx.stroke();

    const imageData = ctx.createImageData(mWidth, mHeight);
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const idx = i * 4;

      if (val === -1) {
        imageData.data[idx] = 112;
        imageData.data[idx + 1] = 128;
        imageData.data[idx + 2] = 144;
        imageData.data[idx + 3] = 255;
      } else if (val >= 0 && val <= 100) {
        const intensity = 255 - Math.floor((val / 100.0) * 255);
        imageData.data[idx] = intensity;
        imageData.data[idx + 1] = intensity;
        imageData.data[idx + 2] = intensity;
        imageData.data[idx + 3] = 255;
      } else {
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 0;
        imageData.data[idx + 3] = 0;
      }
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mWidth;
    tempCanvas.height = mHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(pan.x, height - pan.y);
    ctx.scale(currentScale, -currentScale);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    if (path && path.poses && path.poses.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = COLORS.PATH;
      ctx.lineWidth = 3;
      path.poses.forEach((p, idx) => {
        const cx = toCanvasX(p.pose.position.x);
        const cy = toCanvasY(p.pose.position.y);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      path.poses.forEach((p) => {
        const cx = toCanvasX(p.pose.position.x);
        const cy = toCanvasY(p.pose.position.y);
        ctx.beginPath();
        const r = 4 * currentScale * 0.1;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, '#60a5fa');
        grad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    if (subGoal) {
      const cx = toCanvasX(subGoal.x);
      const cy = toCanvasY(subGoal.y);

      const r = 8 * currentScale * 0.1;

      // Outer glow
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fill();

      // Shiny red sphere
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(1, '#b91c1c');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (scan && odom) {
      ctx.fillStyle = COLORS.SCAN;
      scan.ranges.forEach((range, i) => {
        if (range > scan.range_min && range < scan.range_max) {
          const angle = scan.angle_min + i * scan.angle_increment + odom.yaw;
          const sx = odom.x + range * Math.cos(angle);
          const sy = odom.y + range * Math.sin(angle);
          ctx.beginPath();
          ctx.arc(toCanvasX(sx), toCanvasY(sy), 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    if (markers) {
      markers.markers.forEach(m => {
        if (m.ns === 'inflation' && m.points) {
          ctx.fillStyle = COLORS.INFLATION;
          m.points.forEach(pt => {
            const cx = toCanvasX(pt.x);
            const cy = toCanvasY(pt.y);
            const markerScale = m.scale?.x || resolution;
            const r = Math.max(3, (markerScale / resolution) * currentScale / 2);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
    }

    if (odom) {
      const rx = toCanvasX(odom.x);
      const ry = toCanvasY(odom.y);

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-odom.yaw);

      ctx.fillStyle = '#0f172a';
      const wheelL = (0.2 / resolution) * currentScale;
      const wheelW = (0.04 / resolution) * currentScale;

      const drawWheel = (wx, wy) => {
        const cx = (wx / resolution) * currentScale;
        const cy = (-wy / resolution) * currentScale;
        ctx.fillRect(cx - wheelL / 2, cy - wheelW / 2, wheelL, wheelW);
      };

      drawWheel(-0.33, 0.29);
      drawWheel(-0.33, -0.29);
      drawWheel(0.0, 0.298);
      drawWheel(0.0, -0.298);

      ctx.fillStyle = COLORS.ROBOT;
      const rw = (0.6 / resolution) * currentScale;
      const rh = (0.48 / resolution) * currentScale;
      const bx = (-0.16 / resolution) * currentScale;
      ctx.fillRect(bx - rw / 2, -rh / 2, rw, rh);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1, 4 * (currentScale / resolution) * 0.01);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((0.6 / resolution) * currentScale / 2 + Math.max(2, 5 * (currentScale / resolution) * 0.01), 0);
      ctx.stroke();

      ctx.restore();
    }

    if (goalPreview) {
      const gx = toCanvasX(goalPreview.x);
      const gy = toCanvasY(goalPreview.y);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-goalPreview.yaw);

      ctx.strokeStyle = COLORS.GOAL;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(30, 0);
      ctx.lineTo(20, -5);
      ctx.moveTo(30, 0);
      ctx.lineTo(20, 5);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }, [mapData, odom, scan, path, markers, subGoal, goalPreview, pan, zoom, width, height, COLORS.PATH, COLORS.SCAN, COLORS.ROBOT, COLORS.GOAL, COLORS.INFLATION, isHeadingUp]);

  const handleMouseDown = (e) => {
    if (!mapData || !pan.init) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (e.button === 2 || e.button === 1) {
      // Right or Middle click -> Pan
      setIsPanning(true);
      setPanStart({ cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y });
      return;
    }

    if (e.button === 0) {
      // Left click -> Goal
      const { info } = mapData;
      const { resolution, width: mWidth, height: mHeight, origin } = info;

      const baseScale = Math.min(width / mWidth, height / mHeight);
      const currentScale = baseScale * zoom;

      let mapX, mapY;

      if (isHeadingUp && odom) {
        // Helpers to get unrotated canvas coords
        const getUnrotatedX = (wx) => ((wx - origin.position.x) / resolution) * currentScale + pan.x;
        const getUnrotatedY = (wy) => height - (((wy - origin.position.y) / resolution) * currentScale + pan.y);

        // Transform screen coordinates back to unrotated canvas coordinates
        const dx = cx - width / 2;
        const dy = cy - height / 2;
        const angle = odom.yaw - Math.PI / 2;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        
        const ux = (dx * cos - dy * sin) + getUnrotatedX(odom.x);
        const uy = (dx * sin + dy * cos) + getUnrotatedY(odom.y);

        mapX = (ux - pan.x) / currentScale;
        mapY = (height - uy - pan.y) / currentScale;
      } else {
        mapY = (height - cy - pan.y) / currentScale;
        mapX = (cx - pan.x) / currentScale;
      }

      const wx = mapX * resolution + origin.position.x;
      const wy = mapY * resolution + origin.position.y;

      setIsDragging(true);
      setDragStart({ cx, cy, wx, wy });
      setGoalPreview({ x: wx, y: wy, yaw: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.cx;
      const dy = e.clientY - panStart.cy;
      setPan({
        x: panStart.px + dx,
        y: panStart.py - dy,
        init: true
      });
      return;
    }

    if (isDragging && dragStart && goalPreview) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const dx = cx - dragStart.cx;
      const dy = cy - dragStart.cy;

      // Calculate angle
      let yaw = Math.atan2(-dy, dx);
      if (isHeadingUp && odom) {
          // Adjust yaw for rotation
          yaw -= (odom.yaw - Math.PI / 2);
      }
      setGoalPreview({ ...goalPreview, yaw });
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }

    if (isDragging && goalPreview) {
      onGoalSelect(goalPreview);
      setIsDragging(false);
      setDragStart(null);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault(); // Prevent context menu on right click for panning
  };

  return (
    <CanvasWrapper>
      <StyledCanvas
        ref={canvasRef}
        isPanning={isPanning}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      />
      <StatusOverlay>
        <PulseIndicator />
        LIVE MAP
      </StatusOverlay>
      <ControlsOverlay>
        <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => setIsHeadingUp(!isHeadingUp)}
            style={{ 
              background: isHeadingUp ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            {isHeadingUp ? 'ORIENTATION: HEADING UP' : 'ORIENTATION: NORTH UP'}
          </button>
        </div>
        LEFT CLICK: Set Goal<br />
        RIGHT CLICK: Pan Map<br />
        SCROLL: Zoom Map
      </ControlsOverlay>
    </CanvasWrapper>
  );
};

export default MapCanvas;
