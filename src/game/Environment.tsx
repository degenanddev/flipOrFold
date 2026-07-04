import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GATE_Z, LANE_X } from '../utils/constants'

const SKY = '#b8e0ff'
const HORIZON = '#ffe0f0'
const GROUND = '#fff5e8'
const HILL_A = '#e0c3fc'
const HILL_B = '#ffc8dd'
const HILL_C = '#bde0fe'

/** Low-profile finish line — flat mat only */
export function ScanGate() {
  const lineRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!lineRef.current) return
    const pulse = (Math.sin(state.clock.elapsedTime * 5) + 1) * 0.5
    const mat = lineRef.current.children[0] as THREE.Mesh | undefined
    if (mat?.material instanceof THREE.MeshStandardMaterial) {
      mat.material.emissiveIntensity = 0.15 + pulse * 0.2
    }
  })

  return (
    <group ref={lineRef} position={[0, 0.04, GATE_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 0.5]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.2} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[7.2, 0.28]} />
        <meshBasicMaterial color="#ff6b9d" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

function LanePath({ x, color }: { x: number; color: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -14]} receiveShadow>
        <planeGeometry args={[2.6, 55]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.035, -14]}>
        <planeGeometry args={[2.2, 55]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
    </group>
  )
}

function SkyGradient() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, SKY)
    grad.addColorStop(0.55, '#d4ebff')
    grad.addColorStop(0.78, HORIZON)
    grad.addColorStop(1, '#fff8f0')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 256)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh position={[0, 14, -52]} renderOrder={-10}>
      <planeGeometry args={[70, 36]} />
      <meshBasicMaterial map={texture} depthWrite={false} />
    </mesh>
  )
}

function PastelHill({
  position,
  scale,
  color,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  color: string
}) {
  return (
    <mesh position={position} scale={scale} receiveShadow>
      <sphereGeometry args={[1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  )
}

function DriftingCloud({
  start,
  speed,
  scale,
}: {
  start: [number, number, number]
  speed: number
  scale: number
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * speed
    ref.current.position.x = start[0] + Math.sin(t * 0.4) * 1.2
    ref.current.position.y = start[1] + Math.sin(t * 0.7) * 0.15
  })

  return (
    <group ref={ref} position={start}>
      <mesh scale={scale}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#fff" roughness={1} />
      </mesh>
      <mesh position={[0.85 * scale, -0.12 * scale, 0]} scale={scale * 0.72}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#fff" roughness={1} />
      </mesh>
      <mesh position={[-0.8 * scale, -0.08 * scale, 0.1]} scale={scale * 0.65}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#fff" roughness={1} />
      </mesh>
    </group>
  )
}

function AmbientSparkles() {
  const ref = useRef<THREE.Points>(null)
  const count = 48

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18
      arr[i * 3 + 1] = 2 + Math.random() * 8
      arr[i * 3 + 2] = -5 - Math.random() * 35
    }
    return arr
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.PointsMaterial
    mat.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.15
    ref.current.rotation.y = state.clock.elapsedTime * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#ffd166"
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function LaneEdgeLights() {
  const leftRef = useRef<THREE.Mesh>(null)
  const rightRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const pulse = (Math.sin(state.clock.elapsedTime * 3) + 1) * 0.5
    for (const ref of [leftRef, rightRef]) {
      const mesh = ref.current
      if (mesh?.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissiveIntensity = 0.08 + pulse * 0.12
      }
    }
  })

  return (
    <>
      <mesh ref={leftRef} position={[LANE_X[0] - 1.35, 0.06, -14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.08, 52]} />
        <meshStandardMaterial color="#ff6b9d" emissive="#ff6b9d" emissiveIntensity={0.1} roughness={0.9} />
      </mesh>
      <mesh ref={rightRef} position={[LANE_X[1] + 1.35, 0.06, -14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.08, 52]} />
        <meshStandardMaterial color="#4cc9f0" emissive="#4cc9f0" emissiveIntensity={0.1} roughness={0.9} />
      </mesh>
    </>
  )
}

export function Environment() {
  return (
    <group>
      <SkyGradient />

      <PastelHill position={[-12, -1.5, -48]} scale={[14, 5, 6]} color={HILL_A} />
      <PastelHill position={[0, -2, -52]} scale={[18, 6, 8]} color={HILL_B} />
      <PastelHill position={[13, -1.8, -46]} scale={[12, 4.5, 5]} color={HILL_C} />
      <PastelHill position={[-5, -2.2, -58]} scale={[20, 5.5, 7]} color="#fff0f5" />

      <DriftingCloud start={[-8, 9, -30]} speed={0.35} scale={1.1} />
      <DriftingCloud start={[7, 10, -38]} speed={0.28} scale={0.95} />
      <DriftingCloud start={[-4, 8.5, -45]} speed={0.42} scale={0.8} />
      <DriftingCloud start={[5, 11, -22]} speed={0.3} scale={0.7} />
      <DriftingCloud start={[-10, 7.5, -18]} speed={0.25} scale={0.65} />

      <AmbientSparkles />
      <LaneEdgeLights />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -14]} receiveShadow>
        <planeGeometry args={[16, 55]} />
        <meshStandardMaterial color={GROUND} roughness={0.92} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -14]}>
        <planeGeometry args={[15.2, 53]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.12} roughness={1} />
      </mesh>

      <LanePath x={LANE_X[0]} color="#ffc8dd" />
      <LanePath x={LANE_X[1]} color="#bde0fe" />

      <ambientLight intensity={1.15} color="#fff8f0" />
      <directionalLight position={[4, 14, 8]} intensity={1.45} color="#fff" castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={[SKY, HORIZON, 0.55]} />
      <pointLight position={[-5, 3, -5]} intensity={0.35} color="#ff6b9d" distance={18} />
      <pointLight position={[5, 3, -5]} intensity={0.35} color="#9b5de5" distance={18} />
    </group>
  )
}
