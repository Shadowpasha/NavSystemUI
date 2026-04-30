import React, { useEffect, useState, useRef } from 'react';
import { Ros, Topic } from 'roslib';
import { Activity, Radio, Navigation2, Map as MapIcon, Settings, Compass, Target, Box, Layers, Maximize2, Minimize2, X } from 'lucide-react';
import MapCanvas from './components/MapCanvas';
import Map3DCanvas from './components/Map3DCanvas';
import styled from 'styled-components';
import './App.css';

// --- Styled Components ---

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #0f172a;
  color: #f1f5f9;
  display: flex;
  padding: 1.5rem;
  gap: 1.5rem;
  font-family: 'Inter', system-ui, sans-serif;
`;

const Sidebar = styled.div`
  width: 20rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const IconWrapper = styled.div`
  padding: 0.75rem;
  background-color: #2563eb;
  border-radius: 1rem;
  box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.4), 0 4px 6px -4px rgba(30, 58, 138, 0.4);
`;

const Title = styled.h1`
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
`;

const Subtitle = styled.p`
  color: #94a3b8;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  margin: 0;
`;

const Card = styled.div`
  background-color: #1e293b;
  border-radius: 1.5rem;
  padding: 1.25rem;
  border: 1px solid rgba(51, 65, 85, 0.5);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  flex-grow: ${props => (props.flexGrow ? 1 : 0)};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
`;

const StatusBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  background-color: ${props => (props.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)')};
  color: ${props => (props.connected ? '#10b981' : '#f43f5e')};
`;

const StatusDot = styled.div`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background-color: ${props => (props.connected ? '#10b981' : '#f43f5e')};
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Label = styled.label`
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
  margin-left: 0.25rem;
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Input = styled.input`
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  width: 100%;
  color: #f1f5f9;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  transition: all 0.2s;

  &:focus {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  }
`;

const Button = styled.button`
  background-color: #334155;
  color: #f1f5f9;
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: #475569;
  }
`;

const TelemetryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
`;

const MetricBox = styled.div`
  background-color: rgba(15, 23, 42, 0.5);
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(51, 65, 85, 0.3);
  grid-column: ${props => (props.fullWidth ? 'span 2' : 'auto')};
`;

const MetricHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
`;

const MetricLabel = styled.div`
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
`;

const MetricValue = styled.div`
  font-size: 1.125rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
`;

const MetricUnit = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  margin-left: 0.25rem;
`;

const StatusList = styled.div`
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
`;

const StatusItemLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
`;

const StatusItemValue = styled.span`
  font-weight: ${props => (props.active ? '700' : '400')};
  color: ${props => (props.active ? '#34d399' : '#475569')};
`;

const StatusText = styled.div`
  font-size: 0.85rem;
  color: #f8fafc;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.4;
`;

const StatusPanel = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 1rem;
  border: 1px solid rgba(51, 65, 85, 0.3);
`;

const StatusPanelTitle = styled.div`
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
`;

const MainView = styled.div`
  flex-grow: 1;
  display: flex;
  background-color: #020617;
  border-radius: 40px;
  box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #1e293b;
  position: relative;
  overflow: hidden;
  align-items: stretch;
  justify-content: stretch;
`;

const FloatingWindow = styled.div`
  position: absolute;
  bottom: ${props => props.isMaximized ? '0' : '2rem'};
  right: ${props => props.isMaximized ? '0' : '2rem'};
  width: ${props => props.isMaximized ? '100%' : '600px'};
  height: ${props => props.isMaximized ? '100%' : '380px'};
  background-color: #0f172a;
  border-radius: ${props => props.isMaximized ? '0' : '1.5rem'};
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  border: ${props => props.isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'};
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              right 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`;

const FloatingHeader = styled.div`
  background-color: rgba(37, 99, 235, 0.1);
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #60a5fa;
  border-bottom: 1px solid rgba(37, 99, 235, 0.2);
`;

// --- Component ---

function App() {
  const [ros, setRos] = useState(null);
  const [connected, setConnected] = useState(false);
  const [robotIp, setRobotIp] = useState(window.location.hostname || 'localhost');
  
  const [map, setMap] = useState(null);
  const [odom, setOdom] = useState(null);
  const [scan, setScan] = useState(null);
  const [path, setPath] = useState(null);
  const [octomap, setOctomap] = useState(null);
  const [pointCloud, setPointCloud] = useState(null);
  const [octomapCount, setOctomapCount] = useState(0);
  const [showOctomap, setShowOctomap] = useState(true);
  const [markers, setMarkers] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1000 });
  const [subGoal, setSubGoal] = useState(null);
  const [cameraPoses, setCameraPoses] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [navStatus, setNavStatus] = useState("Offline");

  const goalPubRef = useRef(null);
  const mainViewRef = useRef(null);

  const connectToRos = () => {
    if (ros) ros.close();

    const newRos = new Ros({
      url: `ws://${robotIp}:9090`
    });

    newRos.on('connection', () => {
      console.log('Connected to websocket server.');
      setConnected(true);
      
      goalPubRef.current = new Topic({
        ros: newRos,
        name: '/goal_pose',
        messageType: 'geometry_msgs/PoseStamped'
      });

      const mapSub = new Topic({
        ros: newRos,
        name: '/map',
        messageType: 'nav_msgs/OccupancyGrid'
      });
      mapSub.subscribe((message) => setMap(message));

      const odomSub = new Topic({
        ros: newRos,
        name: '/odom',
        messageType: 'nav_msgs/Odometry'
      });
      odomSub.subscribe((message) => {
        const pose = message.pose.pose;
        const q = pose.orientation;
        const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
        setOdom({
          x: pose.position.x,
          y: pose.position.y,
          yaw: yaw
        });
      });

      const scanSub = new Topic({
        ros: newRos,
        name: '/scan',
        messageType: 'sensor_msgs/LaserScan'
      });
      scanSub.subscribe((message) => setScan(message));

      const pathSub = new Topic({
        ros: newRos,
        name: '/planned_path',
        messageType: 'nav_msgs/Path'
      });
      pathSub.subscribe((message) => setPath(message));

      const markersSub = new Topic({
        ros: newRos,
        name: '/nav_markers',
        messageType: 'visualization_msgs/MarkerArray'
      });
      markersSub.subscribe((message) => {
        setMarkers(prev => {
          if (!prev) return message;
          const newMarkers = [...prev.markers];
          message.markers.forEach(incoming => {
            const idx = newMarkers.findIndex(m => m.id === incoming.id && m.ns === incoming.ns);
            if (idx >= 0) {
              newMarkers[idx] = incoming;
            } else {
              newMarkers.push(incoming);
            }
          });
          return { markers: newMarkers };
        });
      });

      const subGoalSub = new Topic({
        ros: newRos,
        name: '/sub_goal',
        messageType: 'visualization_msgs/Marker'
      });
      subGoalSub.subscribe((message) => {
        setSubGoal({
          x: message.pose.position.x,
          y: message.pose.position.y
        });
      });

      const navStatusSub = new Topic({
        ros: newRos,
        name: '/nav_status',
        messageType: 'std_msgs/String'
      });
      navStatusSub.subscribe((message) => {
        setNavStatus(message.data);
      });

      const octomapSub = new Topic({
        ros: newRos,
        name: '/orbslam/octomap',
        messageType: 'octomap_msgs/Octomap'
      });
      octomapSub.subscribe((message) => {
        setOctomapCount(prev => prev + 1);
        setOctomap(message);
        if (octomapCount % 10 === 0) {
            console.log('Octomap Message:', {
                id: message.id,
                resolution: message.resolution,
                binary: message.binary,
                dataLength: message.data?.length
            });
        }
      });

      const cameraPosesSub = new Topic({
        ros: newRos,
        name: '/orbslam/camera_poses',
        messageType: 'geometry_msgs/PoseArray'
      });
      cameraPosesSub.subscribe((message) => {
        setCameraPoses(message);
      });
    });

    newRos.on('error', (error) => {
      console.log('Error connecting to websocket server: ', error);
      setConnected(false);
    });

    newRos.on('close', () => {
      console.log('Connection to websocket server closed.');
      setConnected(false);
    });

    setRos(newRos);
  };

  useEffect(() => {
    connectToRos();
    return () => {
      if (ros) ros.close();
    };
  }, []);

  useEffect(() => {
    if (!mainViewRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(mainViewRef.current);
    return () => observer.disconnect();
  }, []);

  const handleGoalSelect = (goal) => {
    if (!goalPubRef.current) return;

    const pose = {
      header: {
        frame_id: 'map',
        stamp: { secs: 0, nsecs: 0 }
      },
      pose: {
        position: { x: goal.x, y: goal.y, z: 0 },
        orientation: {
          x: 0,
          y: 0,
          z: Math.sin(goal.yaw / 2),
          w: Math.cos(goal.yaw / 2)
        }
      }
    };

    goalPubRef.current.publish(pose);
    console.log('Goal published:', goal);
  };

  return (
    <AppContainer>
      <Sidebar>
        <Header>
          <IconWrapper>
            <Navigation2 color="#ffffff" size={24} />
          </IconWrapper>
          <div>
            <Title>NavSystem</Title>
            <Subtitle>Autonomous Pilot</Subtitle>
          </div>
        </Header>

        <Card>
          <CardHeader>
            <CardTitle>
              <Settings size={16} />
              Connectivity
            </CardTitle>
            <StatusBadge connected={connected}>
              <StatusDot connected={connected} />
              {connected ? 'STABLE' : 'OFFLINE'}
            </StatusBadge>
          </CardHeader>
          
          <InputGroup>
            <Label>ROBOT ENDPOINT</Label>
            <InputRow>
              <Input 
                type="text" 
                value={robotIp} 
                onChange={(e) => setRobotIp(e.target.value)}
              />
              <Button onClick={connectToRos}>
                <Radio size={16} />
              </Button>
            </InputRow>
          </InputGroup>
        </Card>

        <Card flexGrow={true}>
          <CardHeader>
            <CardTitle>
              <Activity size={16} color="#94a3b8" />
              Telemetry
            </CardTitle>
            <Button 
              style={{ 
                padding: '0.4rem 0.8rem', 
                fontSize: '0.7rem',
                background: showOctomap ? '#2563eb' : '#334155',
                borderRadius: '0.5rem'
              }}
              onClick={() => setShowOctomap(!showOctomap)}
            >
              {showOctomap ? 'HIDE 3D' : 'SHOW 3D'}
            </Button>
          </CardHeader>

          <TelemetryGrid>
            <MetricBox>
              <MetricLabel>X-POS</MetricLabel>
              <MetricValue>{odom?.x.toFixed(2) || '0.00'}<MetricUnit>m</MetricUnit></MetricValue>
            </MetricBox>
            <MetricBox>
              <MetricLabel>Y-POS</MetricLabel>
              <MetricValue>{odom?.y.toFixed(2) || '0.00'}<MetricUnit>m</MetricUnit></MetricValue>
            </MetricBox>
            <MetricBox fullWidth={true}>
              <MetricHeader>
                <MetricLabel>HEADING</MetricLabel>
                <Compass size={12} color="#60a5fa" />
              </MetricHeader>
              <MetricValue>
                {odom ? ((odom.yaw * 180) / Math.PI).toFixed(1) : '0.0'}
                <MetricUnit>°</MetricUnit>
              </MetricValue>
            </MetricBox>
          </TelemetryGrid>

          <StatusPanel>
            <StatusPanelTitle>Active Task</StatusPanelTitle>
            <StatusText>{navStatus}</StatusText>
          </StatusPanel>

          <StatusList>
            <StatusItem>
              <StatusItemLabel>
                <MapIcon size={14} />
                <span>SLAM Map</span>
              </StatusItemLabel>
              <StatusItemValue active={!!map}>{map ? 'ACTIVE' : 'IDLE'}</StatusItemValue>
            </StatusItem>
            <StatusItem>
              <StatusItemLabel>
                <Target size={14} />
                <span>Global Path</span>
              </StatusItemLabel>
              <StatusItemValue active={!!path}>{path ? 'ACTIVE' : 'IDLE'}</StatusItemValue>
            </StatusItem>
          </StatusList>
        </Card>
      </Sidebar>

      <MainView ref={mainViewRef}>
        <MapCanvas 
          mapData={map} 
          odom={odom} 
          scan={scan} 
          path={path}
          markers={markers}
          subGoal={subGoal}
          onGoalSelect={handleGoalSelect}
          width={dimensions.width}
          height={dimensions.height}
        />

        {showOctomap && (
          <FloatingWindow isMaximized={isMaximized}>
            <FloatingHeader>
              <Box size={16} />
              <span>3D SPATIAL MAPPING</span>
              <div style={{ flexGrow: 1 }} />
              <button 
                onClick={() => setIsMaximized(!isMaximized)}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                onClick={() => setShowOctomap(false)}
                style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}
              >
                <X size={16} />
              </button>
            </FloatingHeader>
            <div style={{ flexGrow: 1, position: 'relative' }}>
              <Map3DCanvas 
                octomapData={octomap} 
                cameraPoses={cameraPoses}
                pointCloud={pointCloud}
                odom={odom}
                debugInfo={{ count: octomapCount, type: octomap ? 'OCTOMAP' : 'SEARCHING' }}
              />
            </div>
          </FloatingWindow>
        )}
      </MainView>
    </AppContainer>
  );
}

export default App;
