import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import styled from 'styled-components';

const Container = styled.div`
  width: 100%;
  height: 100%;
  background: #020617;
  position: relative;
`;

const StatusOverlay = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background-color: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(8px);
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
  z-index: 10;
  pointer-events: none;
`;

// --- Components ---

const Voxels = ({ data, pointCloud, resolution }) => {
  const meshRef = useRef();
  
  const points = useMemo(() => {
    const result = [];
    const res = resolution || 0.1;

    // 1. Parse Binary Octomap (Optimized website-side conversion)
    if (data && data.data) {
        let bytes;
        if (typeof data.data === 'string') {
            const binaryString = atob(data.data);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
        } else {
            bytes = new Uint8Array(data.data.map(b => b < 0 ? b + 256 : b));
        }
        
        let offset = 0;
        const maxDisplayPoints = 25000;

        // NEW: Handle raw float points (Dummy Cube)
        if (data.id === 'DummyPoints') {
            const dv = new DataView(bytes.buffer);
            for (let i = 0; i < bytes.length; i += 12) {
                if (i + 12 <= bytes.length) {
                    result.push({
                        x: dv.getFloat32(i, true),
                        y: dv.getFloat32(i + 4, true),
                        z: dv.getFloat32(i + 8, true)
                    });
                }
            }
        } else {
            // Standard OctoMap Bitstream Decoder
            const decodeNode = (x, y, z, depth) => {
          if (offset >= bytes.length || result.length >= maxDisplayPoints) return;
          const mask = bytes[offset++];
          const currentSize = res * Math.pow(2, 16 - depth);
          const s = currentSize / 4; 

          for (let i = 0; i < 8; i++) {
            if (mask & (1 << i)) {
              const dx = (i & 1) ? s : -s;
              const dy = (i & 2) ? s : -s;
              const dz = (i & 4) ? s : -s;
              
              if (depth === 16) {
                if (Math.random() < 0.05) { 
                    result.push({ x: x + dx, y: y + dy, z: z + dz });
                }
              } else {
                decodeNode(x + dx, y + dy, z + dz, depth + 1);
              }
            }
          }
        };
        decodeNode(0, 0, 0, 1);
    }
}

    // 2. Parse PointCloud2 (Standard ROS format)
    if (pointCloud && pointCloud.data) {
        const { data: pcData, point_step, fields } = pointCloud;
        const bytes = (typeof pcData === 'string') 
            ? Uint8Array.from(atob(pcData), c => c.charCodeAt(0)) 
            : new Uint8Array(pcData);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const xOff = fields.find(f => f.name === 'x').offset;
        const yOff = fields.find(f => f.name === 'y').offset;
        const zOff = fields.find(f => f.name === 'z').offset;

        const skip = Math.max(1, Math.floor(bytes.length / point_step / 10000));
        for (let i = 0; i < bytes.length; i += point_step * skip) {
            try {
                result.push({
                    x: dv.getFloat32(i + xOff, true),
                    y: dv.getFloat32(i + yOff, true),
                    z: dv.getFloat32(i + zOff, true)
                });
            } catch(e) {}
        }
    }

    // Auto-Recenter for website
    if (result.length > 0) {
        let sumX = 0, sumY = 0, sumZ = 0;
        result.forEach(p => { sumX += p.x; sumY += p.y; sumZ += p.z; });
        const centerX = sumX / result.length;
        const centerY = sumY / result.length;
        const centerZ = sumZ / result.length;
        result.forEach(p => { 
            p.x -= centerX; 
            p.y -= centerY; 
            p.z = (p.z - centerZ) + 1.0; 
        });
    }

    return result;
  }, [data, pointCloud, resolution]);

  useEffect(() => {
    if (!meshRef.current) return;
    const tempObject = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const res = resolution || 0.1;
    
    points.forEach((p, i) => {
      tempObject.position.set(p.x, p.y, p.z);
      tempObject.scale.set(res * 0.95, res * 0.95, res * 0.95);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
      const h = Math.min(Math.max(p.z, 0), 2.0) / 2.0;
      
      const c1 = new THREE.Color('#2563eb');
      const c2 = new THREE.Color('#06b6d4');
      const c3 = new THREE.Color('#10b981');
      const c4 = new THREE.Color('#f59e0b');
      const c5 = new THREE.Color('#ef4444');

      if (h < 0.25) tempColor.copy(c1).lerp(c2, h * 4);
      else if (h < 0.5) tempColor.copy(c2).lerp(c3, (h - 0.25) * 4);
      else if (h < 0.75) tempColor.copy(c3).lerp(c4, (h - 0.5) * 4);
      else tempColor.copy(c4).lerp(c5, (h - 0.75) * 4);

      meshRef.current.setColorAt(i, tempColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [points, resolution]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, points.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial metalness={0.1} roughness={0.5} />
    </instancedMesh>
  );
};

const Robot = ({ odom }) => {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current && odom) {
      meshRef.current.position.set(odom.x, odom.y, 0.1);
      meshRef.current.rotation.z = odom.yaw;
    }
  });

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#f43f5e" />
      </mesh>
      <mesh position={[0.2, 0, 0]}>
        <boxGeometry args={[0.15, 0.05, 0.05]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

const CameraFrames = ({ poses }) => {
  if (!poses || !poses.poses) return null;
  
  return (
    <group>
      {poses.poses.map((pose, i) => (
        <group 
            key={i} 
            position={[pose.position.x, pose.position.y, pose.position.z]}
            quaternion={[pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w]}
        >
          {/* Camera Wireframe Frustum */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.3, 0.2, 0.2)]} />
            <meshBasicMaterial color="#60a5fa" linewidth={2} />
          </lineSegments>
          {/* Small lens cone */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.15, 0, 0]}>
            <coneGeometry args={[0.05, 0.1, 4]} />
            <meshBasicMaterial color="#3b82f6" wireframe />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Map3DCanvas = ({ octomapData, cameraPoses, pointCloud, odom }) => {
  return (
    <Container>
      <StatusOverlay>
        <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: '#fff' }}>3D NAVIGATION ENGINE</div>
        <div>System: ONLINE</div>
        <div>Resolution: {octomapData?.resolution || 0.1}m</div>
        {octomapData?.data && <div>Payload: {Math.round(octomapData.data.length / 1024)} KB</div>}
      </StatusOverlay>

      <Canvas shadows camera={{ fov: 45, position: [5, -5, 5], up: [0, 0, 1] }}>
        <OrbitControls makeDefault />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />

        <Grid 
          infiniteGrid 
          fadeDistance={50} 
          sectionSize={1} 
          cellSize={0.2} 
          sectionColor="#334155" 
          cellColor="#1e293b"
          rotation={[Math.PI / 2, 0, 0]}
        />
        
        <Voxels data={octomapData} pointCloud={pointCloud} resolution={octomapData?.resolution || 0.2} />
        <CameraFrames poses={cameraPoses} />
      </Canvas>
    </Container>
  );
};

export default Map3DCanvas;
