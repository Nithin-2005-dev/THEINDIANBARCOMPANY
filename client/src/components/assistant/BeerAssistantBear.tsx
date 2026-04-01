"use client"

import { Environment, Lightformer, useGLTF } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import * as THREE from "three"
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js"
import BeerAssistantAvatar from "@/components/assistant/BeerAssistantAvatar"
import styles from "@/components/assistant/BeerAssistantBear.module.css"

type PointerState = {
  x: number
  y: number
}

type BeerAssistantBearProps = {
  active?: boolean
  fallbackSrc?: string | null
  paused?: boolean
  variant?: "trigger" | "avatar"
  onReady?: () => void
}

type BearCanvasBoundaryProps = {
  children: ReactNode
  onFailure: () => void
  resetKey: number
}

type BearCanvasBoundaryState = {
  hasError: boolean
}

class BearCanvasBoundary extends Component<
  BearCanvasBoundaryProps,
  BearCanvasBoundaryState
> {
  state: BearCanvasBoundaryState = {
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
    this.props.onFailure()
  }

  componentDidUpdate(previousProps: BearCanvasBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

function cloneBearMaterial(material: THREE.Material) {
  const nextMaterial = material.clone() as THREE.MeshStandardMaterial
  nextMaterial.roughness = 0.55
  nextMaterial.metalness = 0.08
  nextMaterial.envMapIntensity = 0.95
  nextMaterial.needsUpdate = true
  return nextMaterial
}

function BearModel({
  pointer,
  active,
  paused,
  variant,
  onReady,
}: {
  pointer: PointerState
  active: boolean
  paused: boolean
  variant: "trigger" | "avatar"
  onReady?: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const hasAnnouncedReady = useRef(false)
  const isAvatar = variant === "avatar"

  const { scene } = useGLTF("/models/bear.glb")
  const model = useMemo(() => cloneSkinnedScene(scene), [scene])
  const initialPosition: [number, number, number] = isAvatar ? [0, -1.45, 0] : [0, -1.6, 0]
  const initialRotation: [number, number, number] = isAvatar ? [0.04, 0, 0] : [0.08, 0, 0]
  const modelScale = isAvatar ? 1.34 : 1.9

  useEffect(() => {
    const disposableMaterials: THREE.Material[] = []

    model.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      mesh.frustumCulled = false

      if (Array.isArray(mesh.material)) {
        const nextMaterials = mesh.material.map((material) => {
          const nextMaterial = cloneBearMaterial(material)
          disposableMaterials.push(nextMaterial)
          return nextMaterial
        })
        mesh.material = nextMaterials
        return
      }

      const nextMaterial = cloneBearMaterial(mesh.material)
      disposableMaterials.push(nextMaterial)
      mesh.material = nextMaterial
    })

    return () => {
      disposableMaterials.forEach((material) => material.dispose())
    }
  }, [model])

  useEffect(() => {
    if (hasAnnouncedReady.current) return

    hasAnnouncedReady.current = true
    onReady?.()
  }, [model, onReady])

  useFrame((state, delta) => {
    if (paused || !group.current) return

    const elapsed = state.clock.getElapsedTime()
    const baseX = 0
    const baseY = isAvatar ? -1.45 : -1.6
    const baseZ = 0
    const pointerX = isAvatar ? pointer.x * 0.45 : pointer.x
    const pointerY = isAvatar ? pointer.y * 0.35 : pointer.y

    const targetRotationY =
      pointerX * 0.75 +
      Math.sin(elapsed * 0.6) * (isAvatar ? 0.02 : 0.03) +
      (active ? 0.08 : 0)

    const targetRotationX =
      pointerY * 0.45 +
      Math.sin(elapsed * 0.7) * (isAvatar ? 0.01 : 0.015)

    const targetRotationZ =
      pointerX * -0.08 +
      Math.sin(elapsed * 0.4) * (isAvatar ? 0.008 : 0.01)

    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      targetRotationY,
      6,
      delta,
    )

    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      targetRotationX,
      6,
      delta,
    )

    group.current.rotation.z = THREE.MathUtils.damp(
      group.current.rotation.z,
      targetRotationZ,
      5,
      delta,
    )

    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      baseX + pointerX * 0.08,
      4,
      delta,
    )

    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      baseY - pointerY * 0.04 + Math.sin(elapsed * 1.1) * (isAvatar ? 0.018 : 0.025),
      4,
      delta,
    )

    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z,
      baseZ,
      4,
      delta,
    )
  })

  return (
    <group
      ref={group}
      position={initialPosition}
      rotation={initialRotation}
      scale={modelScale}
    >
      <primitive object={model} />
    </group>
  )
}

function ConciergeEnvironment() {
  return (
    <Environment resolution={128}>
      <group rotation={[0.18, -0.55, 0]}>
        <Lightformer
          color="#fff6ea"
          form="rect"
          intensity={1.3}
          position={[4.5, 3.5, 2]}
          scale={[5.5, 5.5, 1]}
        />
        <Lightformer
          color="#ead7bb"
          form="rect"
          intensity={0.85}
          position={[-4, 1.4, 3]}
          scale={[4.8, 4.8, 1]}
        />
        <Lightformer
          color="#ffffff"
          form="rect"
          intensity={0.35}
          position={[0, 5, -4]}
          scale={[10, 4, 1]}
        />
      </group>
    </Environment>
  )
}

export default function BeerAssistantBear({
  active = false,
  fallbackSrc,
  paused = false,
  variant = "trigger",
  onReady,
}: BeerAssistantBearProps) {
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0 })
  const [canvasKey, setCanvasKey] = useState(0)
  const [showFallback, setShowFallback] = useState(false)
  const interactive = variant === "trigger" && !paused
  const recoveryAttemptsRef = useRef(0)
  const recoveryTimerRef = useRef<number | null>(null)
  const camera = variant === "avatar"
    ? { position: [0, 0, 5.35] as const, fov: 34 }
    : { position: [0, 0, 7] as const, fov: 28 }

  const scheduleRecovery = useCallback(() => {
    recoveryAttemptsRef.current += 1

    if (recoveryAttemptsRef.current > 2) {
      setShowFallback(true)
      return
    }

    if (typeof window === "undefined") {
      setShowFallback(true)
      return
    }

    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current)
    }

    recoveryTimerRef.current = window.setTimeout(() => {
      setCanvasKey((current) => current + 1)
    }, 140)
  }, [])

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!interactive) {
      return
    }

    const updatePointer = (clientX: number, clientY: number) => {
      const x = (clientX / window.innerWidth) * 2 - 1
      const y = (clientY / window.innerHeight) * 2 - 1

      setPointer({
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY)
    }

    const handleMouseMove = (event: MouseEvent) => {
      updatePointer(event.clientX, event.clientY)
    }

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const rect = target.getBoundingClientRect()
      updatePointer(rect.left + rect.width / 2, rect.top + rect.height / 2)
    }

    const handleClick = (event: MouseEvent) => {
      updatePointer(event.clientX, event.clientY)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    window.addEventListener("click", handleClick, { passive: true })
    document.addEventListener("focusin", handleFocus)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("click", handleClick)
      document.removeEventListener("focusin", handleFocus)
    }
  }, [interactive])

  const handleContextLoss = useCallback(
    (event: Event) => {
      event.preventDefault()
      scheduleRecovery()
    },
    [scheduleRecovery],
  )

  const handleCanvasCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      gl.domElement.addEventListener("webglcontextlost", handleContextLoss, false)
    },
    [handleContextLoss],
  )

  if (showFallback) {
    return (
      <div className={styles.stage} aria-hidden="true">
        <BeerAssistantAvatar src={fallbackSrc} className={styles.fallback} />
      </div>
    )
  }

  return (
    <div className={styles.stage} aria-hidden="true">
      <BearCanvasBoundary onFailure={scheduleRecovery} resetKey={canvasKey}>
        <Canvas
          key={canvasKey}
          className={styles.canvas}
          camera={{
            position: camera.position,
            fov: camera.fov,
          }}
          dpr={variant === "avatar" ? [1, 1.2] : [1, 1.35]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "low-power",
            preserveDrawingBuffer: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={handleCanvasCreated}
        >
          <ambientLight intensity={1.8} color="#ffffff" />
          <directionalLight position={[3, 3, 5]} intensity={2.2} color="#ffffff" />
          <directionalLight position={[-3, -2, 4]} intensity={1} color="#ffd7a8" />
          <pointLight position={[0, 1, 3]} intensity={1.2} color="#ffffff" />

          <ConciergeEnvironment />
          <BearModel
            pointer={pointer}
            active={active}
            paused={paused}
            variant={variant}
            onReady={onReady}
          />
        </Canvas>
      </BearCanvasBoundary>
    </div>
  )
}

useGLTF.preload("/models/bear.glb")
