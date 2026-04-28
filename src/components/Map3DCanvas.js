import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

const CanvasWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #020617;
  overflow: hidden;
`;

const StyledCanvas = styled.canvas`
  display: block;
  cursor: move;
`;

const ControlsOverlay = styled.div`
  position: absolute;
  bottom: 1.5rem;
  right: 1.5rem;
  background-color: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(8px);
  padding: 1rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
`;

const StatusOverlay = styled.div`
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  background-color: rgba(30, 41, 59, 0.9);
  backdrop-filter: blur(8px);
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', monospace;
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  pointer-events: none;
`;

const Map3DCanvas = ({ octomapData, pointCloud, odom, width, height, debugInfo }) => {
  const canvasRef = useRef(null);
  const [camera, setCamera] = useState({ yaw: -Math.PI / 4, pitch: Math.PI / 6, zoom: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [telemetry, setTelemetry] = useState({ points: 0, first: null });
  const pointsRef = useRef(0);
  const firstPointRef = useRef(null);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    pointsRef.current = 0;
    firstPointRef.current = null;
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    if (!octomapData) {
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Waiting for 3D Octomap data...', width / 2, height / 2);
      return;
    }

    const { info, data } = octomapData;
    const resolution = info?.resolution || octomapData.resolution || 0.1;
    const mWidth = info?.width;
    const mHeight = info?.height;
    const origin = info?.origin || octomapData.origin || { position: { x: 0, y: 0, z: 0 } };

    // Projection function
    const project = (x, y, z) => {
      // Relative to robot for better focus if odom exists, or origin
      let rx = x - (odom?.x || 0);
      let ry = y - (odom?.y || 0);
      let rz = z;

      // Rotation around Z (Yaw)
      let x1 = rx * Math.cos(camera.yaw) - ry * Math.sin(camera.yaw);
      let y1 = rx * Math.sin(camera.yaw) + ry * Math.cos(camera.yaw);

      // Rotation around X (Pitch)
      let y2 = y1 * Math.cos(camera.pitch) - rz * Math.sin(camera.pitch);
      let z2 = y1 * Math.sin(camera.pitch) + rz * Math.cos(camera.pitch);

      // Scale and Center
      const px = width / 2 + x1 * camera.zoom;
      const py = height / 2 - y2 * camera.zoom;

      return { px, py, depth: z2 };
    };

    const drawCube = (x, y, z, size, color, opacity = 1) => {
      const half = size / 2;
      const points = [
        project(x - half, y - half, z - half),
        project(x + half, y - half, z - half),
        project(x + half, y + half, z - half),
        project(x - half, y + half, z - half),
        project(x - half, y - half, z + half),
        project(x + half, y - half, z + half),
        project(x + half, y + half, z + half),
        project(x - half, y + half, z + half),
      ];

      // Simple painter's algorithm for a single cube: Top, then two visible sides
      ctx.globalAlpha = opacity;
      
      // Top face
      ctx.beginPath();
      ctx.moveTo(points[4].px, points[4].py);
      ctx.lineTo(points[5].px, points[5].py);
      ctx.lineTo(points[6].px, points[6].py);
      ctx.lineTo(points[7].px, points[7].py);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.stroke();

      // Side faces based on camera yaw
      // If we are looking from "front-right", draw Front and Right faces
      const sideColor1 = shadeColor(color, -15);
      const sideColor2 = shadeColor(color, -30);

      // Simple side selection logic
      ctx.beginPath();
      ctx.moveTo(points[5].px, points[5].py);
      ctx.lineTo(points[1].px, points[1].py);
      ctx.lineTo(points[2].px, points[2].py);
      ctx.lineTo(points[6].px, points[6].py);
      ctx.closePath();
      ctx.fillStyle = sideColor1;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(points[4].px, points[4].py);
      ctx.lineTo(points[0].px, points[0].py);
      ctx.lineTo(points[1].px, points[1].py);
      ctx.lineTo(points[5].px, points[5].py);
      ctx.closePath();
      ctx.fillStyle = sideColor2;
      ctx.fill();
      ctx.stroke();
      
      ctx.globalAlpha = 1;
    };

    function shadeColor(col, amt) {
        let usePound = false;
        if (col[0] === "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let g = ((num >> 8) & 0x00FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        let b = (num & 0x0000FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    // Draw Floor Grid (centered on robot)
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 15;
    const step = 1;
    const rx = Math.round(odom?.x || 0);
    const ry = Math.round(odom?.y || 0);

    for (let i = -gridSize; i <= gridSize; i += step) {
      const p1 = project(rx + i, ry - gridSize, 0);
      const p2 = project(rx + i, ry + gridSize, 0);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();

      const p3 = project(rx - gridSize, ry + i, 0);
      const p4 = project(rx + gridSize, ry + i, 0);
      ctx.beginPath();
      ctx.moveTo(p3.px, p3.py);
      ctx.lineTo(p4.px, p4.py);
      ctx.stroke();
    }

    // Draw Occupancy Data as Voxels (from 2D map)
    if (mWidth && mHeight) {
        const range = 8;
        const gx_min = Math.max(0, Math.floor(( (odom?.x || 0) - range - origin.position.x) / resolution));
        const gx_max = Math.min(mWidth - 1, Math.ceil(( (odom?.x || 0) + range - origin.position.x) / resolution));
        const gy_min = Math.max(0, Math.floor(( (odom?.y || 0) - range - origin.position.y) / resolution));
        const gy_max = Math.min(mHeight - 1, Math.ceil(( (odom?.y || 0) + range - origin.position.y) / resolution));

        for (let gy = gy_min; gy <= gy_max; gy++) {
            for (let gx = gx_min; gx <= gx_max; gx++) {
                const idx = gy * mWidth + gx;
                if (data[idx] > 50) {
                    const wx = gx * resolution + origin.position.x;
                    const wy = gy * resolution + origin.position.y;
                    drawCube(wx, wy, 0.05, resolution * 0.9, 'rgba(51, 65, 85, 0.4)', 0.5);
                }
            }
        }
    }

    let pointsDrawn = 0;
    let firstPoint = null;

    // Draw PointCloud2 Data (Real 3D blocks)
    if (pointCloud && pointCloud.data) {
        if (debugInfo?.count % 50 === 0) {
            console.log('PointCloud Processing:', {
                dataLength: pointCloud.data.length,
                pointStep: pointCloud.point_step,
                fields: pointCloud.fields
            });
        }

        const { data: pcData, point_step, fields } = pointCloud;
        const bytes = (typeof pcData === 'string') 
            ? Uint8Array.from(atob(pcData), c => c.charCodeAt(0)) 
            : new Uint8Array(pcData);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        const xOffset = fields.find(f => f.name === 'x').offset;
        const yOffset = fields.find(f => f.name === 'y').offset;
        const zOffset = fields.find(f => f.name === 'z').offset;

        const skip = Math.max(1, Math.floor(bytes.length / point_step / 1500)); 
        
        for (let i = 0; i < bytes.length; i += point_step * skip) {
            try {
                const x = dv.getFloat32(i + xOffset, true);
                const y = dv.getFloat32(i + yOffset, true);
                const z = dv.getFloat32(i + zOffset, true);

                if (!firstPointRef.current) {
                    firstPointRef.current = { x, y, z };
                    console.log('First 3D Point Sample:', firstPointRef.current);
                }

                if (z > -10.0 && z < 10.0) {
                    // Use bright color for debugging
                    drawCube(x, y, z, 0.18, '#00ff00', 1.0);
                    pointsRef.current++;
                }
            } catch (e) {
                if (debugInfo?.count % 100 === 0) console.error('PC Parse Error:', e);
            }
        }
    }

    // Periodically update telemetry state (throttle for performance)
    if (telemetry.points !== pointsRef.current) {
        setTelemetry({ points: pointsRef.current, first: firstPointRef.current });
    }

    // Draw Robot
    if (odom) {
        drawCube(odom.x, odom.y, 0.1, 0.2, '#f43f5e');
        // Direction arrow
        const head = project(odom.x + 0.3 * Math.cos(odom.yaw), odom.y + 0.3 * Math.sin(odom.yaw), 0.1);
        const base = project(odom.x, odom.y, 0.1);
        ctx.beginPath();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.moveTo(base.px, base.py);
        ctx.lineTo(head.px, head.py);
        ctx.stroke();
    }

  }, [octomapData, pointCloud, camera, odom, width, height, telemetry]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    
    setCamera(prev => ({
      ...prev,
      yaw: prev.yaw + dx * 0.01,
      pitch: Math.max(0.1, Math.min(Math.PI / 2 - 0.1, prev.pitch + dy * 0.01))
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(5, Math.min(200, prev.zoom - e.deltaY * 0.1))
    }));
  };

  return (
    <CanvasWrapper onWheel={handleWheel}>
      <StyledCanvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <StatusOverlay>
        <div style={{ fontWeight: 800 }}>LIVE 3D FEED</div>
        <div>Topic: {debugInfo?.type}</div>
        <div>Messages: {debugInfo?.count}</div>
        <div>Points: {telemetry.points}</div>
        {telemetry.first && (
          <div style={{ fontSize: '0.5rem', color: '#94a3b8' }}>
            X:{telemetry.first.x.toFixed(1)} Y:{telemetry.first.y.toFixed(1)} Z:{telemetry.first.z.toFixed(1)}
          </div>
        )}
        {octomapData?.resolution && <div>Res: {octomapData.resolution}m</div>}
        {octomapData?.binary && <div style={{ color: '#f43f5e' }}>MODE: BINARY (UNSUPPORTED)</div>}
      </StatusOverlay>
      <ControlsOverlay>
        DRAG: Rotate Camera • SCROLL: Zoom
      </ControlsOverlay>
    </CanvasWrapper>
  );
};

export default Map3DCanvas;
