"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, useGLTF, Float, Sparkles } from "@react-three/drei"
import { EffectComposer, DepthOfField, Bloom, Vignette } from "@react-three/postprocessing"
import { usePathname } from "next/navigation"
import { useRef, useEffect, useState } from "react"
import * as THREE from "three"

/* =========================================================
   THEME COLORS
========================================================= */

const themeColors: Record<string, string> = {
  "theme-martini": "#ff3b3b",
  "theme-cosmo": "#c084fc",
  "theme-negroni": "#2dd4bf",
  "theme-bm": "#ef4444",
  "theme-tib": "#f59e0b",
}

/* =========================================================
   MODEL — ULTRA MOTION
========================================================= */

function Model({ color }: { color: THREE.Color }) {
  const group = useRef<THREE.Group>(null!)
  const { scene } = useGLTF("/models/cocktail.glb")

  const scrollTarget = useRef(0)
  const scrollSmooth = useRef(0)
  const mouse = useRef({ x: 0, y: 0 })

  /* ---------- Scroll tracking ---------- */

  useEffect(() => {
    const onScroll = () => (scrollTarget.current = window.scrollY)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* ---------- Mouse parallax ---------- */

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  /* ---------- Liquid glow ---------- */

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (!mat) return

        if (mesh.name.toLowerCase().includes("liquid")) {
          mat.emissive = color
          mat.emissiveIntensity = 1.6
        }

        mat.needsUpdate = true
      }
    })
  }, [scene, color])

  /* ---------- Cinematic Motion ---------- */

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    scrollSmooth.current = THREE.MathUtils.lerp(
      scrollSmooth.current,
      scrollTarget.current,
      0.07
    )

    const s = scrollSmooth.current
    const m = mouse.current

    // Showroom rotation
    group.current.rotation.y = t * 0.12 + m.x * 0.25

    // Tilt from mouse
    group.current.rotation.x = Math.sin(t * 0.3) * 0.05 + m.y * 0.15

    // Parallax movement
    group.current.position.y = -s * 0.0007 + m.y * 0.3
    group.current.position.x = Math.sin(t * 0.5) * 0.25 + m.x * 0.4

    // Subtle zoom on scroll
    const scale = 20 + s * 0.002
    group.current.scale.set(scale, scale, scale)
  })

  return <primitive ref={group} object={scene} />
}

/* =========================================================
   DYNAMIC CAMERA
========================================================= */

function CameraMotion() {
  const { camera } = useThree()
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      mouse.current.x * 0.6,
      0.05
    )
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      mouse.current.y * 0.4,
      0.05
    )
    camera.lookAt(0, 0, 0)
  })

  return null
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function FloatingCocktail() {
  const pathname = usePathname()
  const [color, setColor] = useState(new THREE.Color("#f59e0b"))

  useEffect(() => {
    const routeTheme =
      pathname.startsWith("/martini") ? "theme-martini"
      : pathname.startsWith("/negroni") ? "theme-negroni"
      : pathname.startsWith("/cosmo") ? "theme-cosmo"
      : pathname.startsWith("/bloody-mary") ? "theme-bm"
      : "theme-tib"

    setColor(new THREE.Color(themeColors[routeTheme]))
  }, [pathname])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Premium Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[6, 6, 6]} intensity={2} color={color} />
        <directionalLight position={[-6, 3, -5]} intensity={1.2} color={color} />

        {/* Reflections */}
        <Environment preset="night" />

        {/* Floating atmosphere particles */}
        <Sparkles
          count={80}
          scale={20}
          size={2}
          speed={0.2}
          opacity={0.3}
          color={color}
        />

        {/* Floating motion wrapper */}
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.4}>
          <Model color={color} />
        </Float>

        <CameraMotion />

        {/* ===== CINEMATIC POST FX ===== */}
        <EffectComposer>
          <DepthOfField
            focusDistance={0.02}
            focalLength={0.02}
            bokehScale={4}
            height={480}
          />

          <Bloom
            intensity={0.9}
            luminanceThreshold={0.25}
            luminanceSmoothing={0.9}
          />

          <Vignette eskil={false} offset={0.15} darkness={1.3} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

useGLTF.preload("/models/cocktail.glb")