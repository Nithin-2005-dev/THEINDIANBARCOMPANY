"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, Lightformer, useGLTF } from "@react-three/drei"
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { usePathname, useSearchParams } from "next/navigation"
import * as THREE from "three"

import { resolveBookingService } from "@/components/booking/booking-service-config"
import { resolveThemeName, themeColors, type ThemeName } from "@/lib/theme"

const MODEL_ROTATION_AXIS = new THREE.Vector3(
  1.1544037543310688,
  0.08228379459718935,
  -0.5688350335225585,
)

const MODEL_SOURCE_MAX_DIM = 0.1642840056094676
const MODEL_VISUAL_SCALE = 1
const MODEL_NORMALIZE_SCALE = 1 / MODEL_SOURCE_MAX_DIM

type FloatingCocktailBoundaryProps = {
  children: ReactNode
}

type FloatingCocktailBoundaryState = {
  hasError: boolean
}

class FloatingCocktailBoundary extends Component<
  FloatingCocktailBoundaryProps,
  FloatingCocktailBoundaryState
> {
  state: FloatingCocktailBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void error
    void errorInfo
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

// -----------------------------------------------------
// 🥂 MODEL
// -----------------------------------------------------

function Model({ color }: { color: THREE.Color }) {
  const pivot = useRef<THREE.Group>(null!)
  const { scene } = useGLTF("/models/cocktail.glb")
  const model = useMemo(() => scene.clone(true), [scene])

  // Normalize + center model
  useLayoutEffect(() => {
    model.position.set(
      -MODEL_ROTATION_AXIS.x * MODEL_NORMALIZE_SCALE,
      -MODEL_ROTATION_AXIS.y * MODEL_NORMALIZE_SCALE,
      -MODEL_ROTATION_AXIS.z * MODEL_NORMALIZE_SCALE,
    )

    model.scale.setScalar(MODEL_NORMALIZE_SCALE)
    model.updateMatrixWorld(true)
  }, [model])

  // Premium material tuning
  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return

      const material = mesh.material as THREE.MeshStandardMaterial
      if (!material?.isMeshStandardMaterial) return

      material.emissive = color
      material.emissiveIntensity = 0.24
      material.roughness = 0.035
      material.metalness = 0.88
      material.envMapIntensity = 2.3
      material.needsUpdate = true
    })
  }, [model, color])

  // -----------------------------------------------------
  // 🎬 HOLLYWOOD-GRADE MOTION SYSTEM
  // -----------------------------------------------------

useFrame((state, delta) => {
  if (!pivot.current) return

  const t = state.clock.getElapsedTime()

  // ---------------------------------------
  // 🫧 FLOAT — pedestal display feel
  // ---------------------------------------

  const floatY =
    Math.sin(t * 0.85) * 0.07 +
    Math.sin(t * 0.22) * 0.03

  pivot.current.position.y = THREE.MathUtils.damp(
    pivot.current.position.y,
    floatY,
    3,
    delta,
  )

  // ---------------------------------------
  // 🌀 MULTI-AXIS PREMIUM ROTATION
  // ---------------------------------------

  const rotY =
    Math.sin(t * 0.45) * 1.0 +
    Math.sin(t * 0.12) * 0.5

  const rotX =
    Math.sin(t * 0.35) * 0.25

  const rotZ =
    Math.cos(t * 0.28) * 0.2

  pivot.current.rotation.y = THREE.MathUtils.damp(
    pivot.current.rotation.y,
    rotY,
    4,
    delta,
  )

  pivot.current.rotation.x = THREE.MathUtils.damp(
    pivot.current.rotation.x,
    rotX,
    4,
    delta,
  )

  pivot.current.rotation.z = THREE.MathUtils.damp(
    pivot.current.rotation.z,
    rotZ,
    4,
    delta,
  )

  // ---------------------------------------
  // 🎧 RHYTHMIC ACCENT (club pulse)
  // ---------------------------------------

  const pulse = Math.sin(t * 1.6) * 0.08

  pivot.current.rotation.y += pulse * delta * 5

  // ---------------------------------------
  // ✨ SCALE BEAT — subtle energy
  // ---------------------------------------

  const scale =
    1 +
    Math.sin(t * 1.1) * 0.02 +
    Math.sin(t * 0.3) * 0.01

  pivot.current.scale.setScalar(scale)

  // ---------------------------------------
  // 🎥 CAMERA CLUB SWAY (no pointer)
  // ---------------------------------------

  const camZ = 4.6 + Math.sin(t * 0.5) * 0.15
  const camX = Math.sin(t * 0.3) * 0.12

  state.camera.position.z = THREE.MathUtils.damp(
    state.camera.position.z,
    camZ,
    3,
    delta,
  )

  state.camera.position.x = THREE.MathUtils.damp(
    state.camera.position.x,
    camX,
    3,
    delta,
  )

  state.camera.lookAt(0, 0, 0)
})

  return (
    <group ref={pivot} position={[0, 0, 0]} scale={MODEL_VISUAL_SCALE}>
      <primitive object={model} />
    </group>
  )
}

function SunsetEnvironment() {
  return (
    // Keep the sunset look local so the scene does not depend on remote HDRI preset assets.
    <Environment resolution={256} frames={1} environmentIntensity={1.45}>
      <group rotation={[0.18, -0.78, 0.06]}>
        <Lightformer
          color="#fff4dd"
          form="rect"
          intensity={3.6}
          position={[5.8, 4.2, 3]}
          scale={[7.4, 6.2, 1]}
        />
        <Lightformer
          color="#fff7ef"
          form="rect"
          intensity={1.9}
          position={[-4.6, 1.8, 4.4]}
          scale={[1.3, 8.8, 1]}
        />
        <Lightformer
          color="#ffd39e"
          form="rect"
          intensity={1.4}
          position={[3.9, 0.2, 4.6]}
          scale={[1.1, 7.6, 1]}
        />
        <Lightformer
          color="#ff8a5c"
          form="rect"
          intensity={1.85}
          position={[-6.2, -0.5, 1.5]}
          scale={[10, 2.8, 1]}
        />
        <Lightformer
          color="#ff4f7f"
          form="rect"
          intensity={1.45}
          position={[0.4, 3, -5.8]}
          scale={[13, 4.8, 1]}
        />
        <Lightformer
          color="#fff2d2"
          form="rect"
          intensity={0.95}
          position={[0, 6.8, -1.6]}
          scale={[11, 4.4, 1]}
        />
        <Lightformer
          color="#ffbe72"
          form="rect"
          intensity={0.7}
          position={[0.8, -3.2, 3.4]}
          scale={[7.6, 1.8, 1]}
        />
      </group>
    </Environment>
  )
}

function resolveBookingTheme(pathname: string, bookingServiceValue?: string | null): ThemeName | null {
  const bookingSegment = pathname.startsWith("/booking/")
    ? pathname.split("/")[2] ?? null
    : bookingServiceValue

  const service = resolveBookingService(bookingSegment)

  if (!service) {
    return pathname.startsWith("/booking") ? "tib" : null
  }

  if (service.slug === "martini") return "martini"
  if (service.slug === "negroni") return "negroni"
  if (service.slug === "corporate") return "cosmo"
  if (service.slug === "festival") return "bm"

  return "tib"
}

// -----------------------------------------------------
// 🎬 HERO CONTAINER
// -----------------------------------------------------

export default function FloatingCocktail() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedBookingService = searchParams.get("service")
  const themeName = useMemo(
    () => resolveBookingTheme(pathname, selectedBookingService) ?? resolveThemeName(pathname),
    [pathname, selectedBookingService],
  )
  const color = useMemo(
    () => new THREE.Color(themeColors[themeName]),
    [themeName],
  )

  const isAllowedPage =
    pathname === "/" ||
    pathname === "/team" ||
    pathname === "/martini" ||
    pathname === "/negroni" ||
    pathname === "/cosmo" ||
    pathname === "/bloody-mary" ||
    pathname === "/booking" ||
    pathname.startsWith("/booking/")

  if (!isAllowedPage) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <FloatingCocktailBoundary>
        <Canvas
          style={{ width: "100vw", height: "100vh" }}
          camera={{ position: [0, 0, 4.6], fov: 30 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.46,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          {/* Controlled base glow for a premium product-shot contrast */}
          <ambientLight intensity={0.62} />
          <hemisphereLight
            args={["#ffe1b8", "#1a0608", 0.92]}
          />

          {/* Key light */}
          <directionalLight
            position={[4.8, 6.2, 5.8]}
            intensity={3.6}
            color="#fff0d8"
          />

          {/* Glossy front key for the bowl and stem */}
          <spotLight
            position={[2.4, 5.8, 7]}
            angle={0.34}
            penumbra={0.9}
            intensity={3.25}
            color="#fff7eb"
          />

          {/* Warm and jewel-tone fills for rich reflections */}
          <pointLight position={[0.6, 2.4, 4.5]} intensity={1.3} color="#ffd4a4" />
          <pointLight position={[-3.4, -0.6, 3.4]} intensity={1.1} color="#ffe7c8" />
          <pointLight position={[3.2, -2.2, 0.8]} intensity={1.05} color="#ff6f91" />
          <pointLight position={[-1.8, 3.3, -3.4]} intensity={0.85} color={color} />

          {/* Rear rim to separate the silhouette from the background */}
          <spotLight
            position={[-2.8, 4.2, -4.8]}
            angle={0.4}
            penumbra={1}
            intensity={2.2}
            color="#ffbf8a"
          />

          <Suspense fallback={null}>
            <SunsetEnvironment />
            <Model color={color} />
          </Suspense>
        </Canvas>
      </FloatingCocktailBoundary>
    </div>
  )
}

useGLTF.preload("/models/cocktail.glb")
