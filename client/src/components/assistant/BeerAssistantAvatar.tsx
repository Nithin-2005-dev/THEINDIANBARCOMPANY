"use client"
/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js"
import styles from "@/components/assistant/BeerAssistantAvatar.module.css"

let bearAvatarUrl: string | null = null
let bearAvatarPromise: Promise<string> | null = null

function cloneAvatarMaterial(material: THREE.Material) {
  const nextMaterial = material.clone() as THREE.MeshStandardMaterial
  nextMaterial.roughness = 0.58
  nextMaterial.metalness = 0.08
  nextMaterial.envMapIntensity = 1.45
  nextMaterial.needsUpdate = true
  return nextMaterial
}

export async function preloadBeerAvatarSprite() {
  return loadBearAvatarSprite()
}

async function loadBearAvatarSprite() {
  if (bearAvatarUrl) return bearAvatarUrl
  if (bearAvatarPromise) return bearAvatarPromise

  bearAvatarPromise = (async () => {
    const loader = new GLTFLoader()
    const { scene } = await loader.loadAsync("/models/bear.glb")
    const model = cloneSkinnedScene(scene)
    const disposableMaterials: THREE.Material[] = []

    model.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      mesh.frustumCulled = false

      if (Array.isArray(mesh.material)) {
        const nextMaterials = mesh.material.map((material) => {
          const nextMaterial = cloneAvatarMaterial(material)
          disposableMaterials.push(nextMaterial)
          return nextMaterial
        })
        mesh.material = nextMaterials
        return
      }

      const nextMaterial = cloneAvatarMaterial(mesh.material)
      disposableMaterials.push(nextMaterial)
      mesh.material = nextMaterial
    })

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(320, 320, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    const scene3d = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 5.35)

    const root = new THREE.Group()
    root.position.set(0, -1.45, 0)
    root.rotation.set(0.04, 0, 0)
    root.scale.setScalar(1.34)
    root.add(model)
    scene3d.add(root)

    const ambient = new THREE.AmbientLight(0xffffff, 2.1)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6)
    keyLight.position.set(3, 3, 5)
    const fillLight = new THREE.DirectionalLight(0xffd7a8, 1.1)
    fillLight.position.set(-3, -2, 4)
    const rimLight = new THREE.PointLight(0xffffff, 1.15)
    rimLight.position.set(0, 1, 3)

    scene3d.add(ambient, keyLight, fillLight, rimLight)

    renderer.render(scene3d, camera)

    const dataUrl = renderer.domElement.toDataURL("image/png")
    if (!dataUrl.startsWith("data:image/png") || dataUrl.length < 256) {
      disposableMaterials.forEach((material) => material.dispose())
      renderer.dispose()
      throw new Error("Failed to render bear avatar sprite")
    }

    disposableMaterials.forEach((material) => material.dispose())
    renderer.dispose()

    bearAvatarUrl = dataUrl
    return dataUrl
  })().finally(() => {
    bearAvatarPromise = null
  })

  return bearAvatarPromise
}

type BeerAssistantAvatarProps = {
  src?: string | null
  className?: string
}

export default function BeerAssistantAvatar({ src, className }: BeerAssistantAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const nextSrc = src?.trim() || bearAvatarUrl || ""
  const resolvedSrc =
    nextSrc && nextSrc !== "data:," && nextSrc !== failedSrc ? nextSrc : null

  return resolvedSrc ? (
    <img
      className={`${styles.avatar} ${className ?? ""}`.trim()}
      src={resolvedSrc}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailedSrc(nextSrc)}
    />
  ) : (
    <span className={`${styles.avatar} ${styles.placeholder} ${className ?? ""}`.trim()} aria-hidden="true" />
  )
}
