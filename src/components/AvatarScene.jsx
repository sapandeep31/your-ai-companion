import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { VRMAvatar } from '../avatar/VRMAvatar';

function Loader() {
  return (
    <Html center>
      <div className="vrm-loader-container">
        <div className="vrm-spinner"></div>
        <p>Loading 3D Avatar...</p>
      </div>
    </Html>
  );
}

export function AvatarScene({
  activeExpression,
  activeAnimation,
  customArmPose,
  lipSyncController,
  actionRecorder,
  onVrmLoaded,
  backgroundImage,
  shirtColor
}) {
  const [error, setError] = useState(null);

  const canvasBackground = backgroundImage
    ? `url("${backgroundImage}") center center / cover no-repeat`
    : 'radial-gradient(circle at 50% 30%, #202336 0%, #0d0e15 100%)';

  return (
    <div className="avatar-scene-container">
      {error && (
        <div className="vrm-error-overlay">
          <div className="vrm-error-card">
            <h3>⚠️ VRM Load Error</h3>
            <p>{error}</p>
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              Retry Loading
            </button>
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 1.4, 1.25], fov: 32 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: canvasBackground }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[1, 2.5, 1.5]} intensity={1.8} />
        <directionalLight position={[-1, 1.5, -1]} intensity={0.5} />

        <Suspense fallback={<Loader />}>
          <VRMAvatar
            url="/avatar.vrm"
            activeExpression={activeExpression}
            activeAnimation={activeAnimation}
            customArmPose={customArmPose}
            lipSyncController={lipSyncController}
            actionRecorder={actionRecorder}
            onVrmLoaded={onVrmLoaded}
            onError={(msg) => setError(msg)}
            shirtColor={shirtColor}
          />
        </Suspense>

        <OrbitControls
          target={[0, 1.25, 0]}
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={4.0}
          maxPolarAngle={Math.PI / 2 + 0.1}
        />
      </Canvas>
    </div>
  );
}
