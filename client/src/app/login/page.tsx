import { Suspense } from "react"
import LoginFlow from "@/components/auth/login-flow/LoginFlow"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFlow />
    </Suspense>
  )
}
