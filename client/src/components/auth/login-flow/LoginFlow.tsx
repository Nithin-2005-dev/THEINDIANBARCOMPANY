"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/components/dashboard/ToastProvider"
import {
  PUBLIC_LOGIN_ROLES,
  getRoleLoginPath,
  getRolePendingAuthKey,
  getRoleQueryValue,
  normalizeRoleQueryValue,
  type WorkspaceRole,
} from "@/lib/auth-routes"
import {
  describeLoginIdentifier,
  detectLoginIdentifier,
  normalizeLoginIdentifier,
} from "@/lib/auth-identifier"
import { showApiErrorToast } from "@/lib/api"
import {
  fetchSharedAuthSession,
  getPostLoginRedirectPath,
  sendSharedLoginOtp,
  verifySharedLoginOtp,
} from "@/lib/login-auth"
import styles from "./LoginFlow.module.css"

type LoginStep = "role" | "details" | "verify"

type PendingLoginState = {
  challengeId?: string
  identifier?: string
  sentTo?: string
  channel?: "PHONE" | "EMAIL"
}

type RoleMeta = {
  label: string
  kicker: string
  summary: string
  description: string
  identifierLabel: string
  nameLabel?: string
  allowName: boolean
  sendLabel: string
  codeHint: string
}

const ROLE_META: Record<WorkspaceRole, RoleMeta> = {
  CLIENT: {
    label: "Client",
    kicker: "Event access",
    summary: "Track your event, payments, and messages.",
    description: "Use the phone number or email linked to your booking. If this is your first visit, add your name so we can set up your access.",
    identifierLabel: "Phone or email",
    nameLabel: "Your name",
    allowName: true,
    sendLabel: "Send code",
    codeHint: "Enter the code we sent to continue.",
  },
  STAFF: {
    label: "Staff",
    kicker: "Team access",
    summary: "Open your assigned events and updates.",
    description: "Use your work phone number or email. This sign in is only for team members with active access.",
    identifierLabel: "Work phone or email",
    allowName: false,
    sendLabel: "Send work code",
    codeHint: "Enter the code sent to your work contact.",
  },
  ADMIN: {
    label: "Admin",
    kicker: "Operations access",
    summary: "Open bookings, team, and finance tools.",
    description: "Use your approved admin phone number or email. This sign in is reserved for internal leaders.",
    identifierLabel: "Work phone or email",
    allowName: false,
    sendLabel: "Send admin code",
    codeHint: "Enter the code sent to your work contact.",
  },
  VENDOR: {
    label: "Vendor",
    kicker: "Partner access",
    summary: "See your assigned work and updates.",
    description: "Use the phone number or email linked to your partner account.",
    identifierLabel: "Phone or email",
    allowName: false,
    sendLabel: "Send code",
    codeHint: "Enter the code we sent to continue.",
  },
}

const LEGACY_PENDING_KEYS: Partial<Record<WorkspaceRole, string[]>> = {
  CLIENT: ["tib_client_pending_auth"],
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function readPendingLoginState(role: WorkspaceRole): PendingLoginState | null {
  if (typeof window === "undefined") return null

  const storageKeys = [getRolePendingAuthKey(role), ...(LEGACY_PENDING_KEYS[role] ?? [])]

  for (const storageKey of storageKeys) {
    const rawValue = window.sessionStorage.getItem(storageKey)

    if (!rawValue) {
      continue
    }

    try {
      const parsed = JSON.parse(rawValue) as PendingLoginState
      if (parsed.challengeId && parsed.identifier) {
        return parsed
      }
    } catch {
      window.sessionStorage.removeItem(storageKey)
    }
  }

  return null
}

function storePendingLoginState(role: WorkspaceRole, value: PendingLoginState) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(getRolePendingAuthKey(role), JSON.stringify(value))
}

function clearPendingLoginState(role: WorkspaceRole) {
  if (typeof window === "undefined") return

  for (const storageKey of [getRolePendingAuthKey(role), ...(LEGACY_PENDING_KEYS[role] ?? [])]) {
    window.sessionStorage.removeItem(storageKey)
  }
}

export default function LoginFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pushToast } = useToast()
  const nextPath = searchParams.get("next")
  const requestedRole = normalizeRoleQueryValue(searchParams.get("role"))
  const requestedStep = searchParams.get("step") === "verify" ? "verify" : "details"
  const identifierParam =
    searchParams.get("identifier") ??
    searchParams.get("phone") ??
    searchParams.get("email") ??
    ""

  const [checkingSession, setCheckingSession] = useState(true)
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole | null>(requestedRole)
  const [step, setStep] = useState<LoginStep>(requestedRole ? requestedStep : "role")
  const [identifier, setIdentifier] = useState(identifierParam)
  const [name, setName] = useState("")
  const [sentTo, setSentTo] = useState(identifierParam)
  const [challengeId, setChallengeId] = useState("")
  const [otp, setOtp] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const roleMeta = selectedRole ? ROLE_META[selectedRole] : null

  const stepStates = useMemo(() => {
    return [
      {
        id: "role",
        label: "Choose role",
        active: step === "role",
        complete: step !== "role",
      },
      {
        id: "details",
        label: "Enter details",
        active: step === "details",
        complete: step === "verify",
      },
      {
        id: "verify",
        label: "Enter code",
        active: step === "verify",
        complete: false,
      },
    ]
  }, [step])

  useEffect(() => {
    let active = true

    fetchSharedAuthSession()
      .then((data) => {
        if (!active) return
        router.replace(getPostLoginRedirectPath(data.user.role, nextPath))
      })
      .catch(() => {
        if (active) {
          setCheckingSession(false)
        }
      })

    return () => {
      active = false
    }
  }, [nextPath, router])

  useEffect(() => {
    if (!requestedRole) {
      setSelectedRole(null)
      setStep("role")
      setChallengeId("")
      setOtp("")
      return
    }

    setSelectedRole(requestedRole)

    if (requestedStep === "verify") {
      const pendingState = readPendingLoginState(requestedRole)

      if (pendingState?.challengeId && pendingState.identifier) {
        setStep("verify")
        setChallengeId(pendingState.challengeId)
        setIdentifier(pendingState.identifier)
        setSentTo(pendingState.sentTo ?? pendingState.identifier)
        return
      }

      setStep("details")
      setChallengeId("")
      setOtp("")
      setSentTo(identifierParam)
      setIdentifier(identifierParam)
      setError("Enter your details again and we’ll send a fresh code.")
      return
    }

    setStep("details")
    setChallengeId("")
    setOtp("")

    if (identifierParam) {
      setIdentifier(identifierParam)
      setSentTo(identifierParam)
    }
  }, [identifierParam, requestedRole, requestedStep])

  function buildLoginUrl(role?: WorkspaceRole | null, next?: string | null, currentStep?: LoginStep, currentIdentifier?: string) {
    if (!role) {
      return next ? `/login?next=${encodeURIComponent(next)}` : "/login"
    }

    const params = new URLSearchParams()
    params.set("role", getRoleQueryValue(role))

    if (next) {
      params.set("next", next)
    }

    if (currentStep === "verify") {
      params.set("step", "verify")
    }

    if (currentIdentifier) {
      params.set("identifier", currentIdentifier)
    }

    return `/login?${params.toString()}`
  }

  function selectRole(role: WorkspaceRole) {
    setSelectedRole(role)
    setStep("details")
    setIdentifier("")
    setName("")
    setOtp("")
    setChallengeId("")
    setMessage(null)
    setError(null)
    router.replace(buildLoginUrl(role, nextPath, "details"))
  }

  function changeRole() {
    setSelectedRole(null)
    setStep("role")
    setIdentifier("")
    setName("")
    setOtp("")
    setChallengeId("")
    setSentTo("")
    setMessage(null)
    setError(null)
    router.replace(buildLoginUrl(null, nextPath))
  }

  async function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedRole) {
      setError("Choose how you want to sign in.")
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const normalizedIdentifier = normalizeLoginIdentifier(identifier)

      if (detectLoginIdentifier(normalizedIdentifier) === "unknown") {
        throw new Error("Enter a valid phone number or email address.")
      }

      const data = await sendSharedLoginOtp(selectedRole, {
        identifier: normalizedIdentifier,
        name: selectedRole === "CLIENT" ? name || undefined : undefined,
      })

      storePendingLoginState(selectedRole, {
        challengeId: data.challengeId,
        identifier: normalizedIdentifier,
        sentTo: data.sentTo,
        channel: data.channel,
      })

      setIdentifier(normalizedIdentifier)
      setSentTo(data.sentTo ?? normalizedIdentifier)
      setChallengeId(data.challengeId)
      setMessage(`Code sent to your ${describeLoginIdentifier(normalizedIdentifier)}.`)
      setOtp("")
      setStep("verify")
      router.replace(buildLoginUrl(selectedRole, nextPath, "verify", normalizedIdentifier))
    } catch (nextError) {
      const nextMessage =
        nextError instanceof Error ? nextError.message : "Unable to send your sign-in code."
      setError(nextMessage)
      showApiErrorToast({ pushToast }, nextError, "Unable to send code")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedRole) {
      setError("Choose how you want to sign in.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await verifySharedLoginOtp(selectedRole, {
        challengeId,
        identifier,
        otp,
      })

      clearPendingLoginState(selectedRole)
      router.replace(getPostLoginRedirectPath(data.user.role, nextPath))
    } catch (nextError) {
      const nextMessage =
        nextError instanceof Error ? nextError.message : "Unable to verify your code."
      setError(nextMessage)
      showApiErrorToast({ pushToast }, nextError, "Unable to verify code")
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <aside className={styles.sidebar}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandMark}>TIB</span>
              <span className={styles.brandText}>The Indian Bar Company</span>
            </Link>
          </aside>
          <section className={styles.panel}>
            <p className={styles.kicker}>Secure access</p>
            <h1 className={styles.title}>Checking your access</h1>
            <p className={styles.description}>
              We’re confirming whether you already have an active dashboard session.
            </p>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.sidebar}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>TIB</span>
            <span className={styles.brandText}>The Indian Bar Company</span>
          </Link>

          <div className={styles.sidebarBlock}>
            <p className={styles.sidebarLabel}>Sign in steps</p>
            <div className={styles.stepList}>
              {stepStates.map((item) => (
                <div
                  key={item.id}
                  className={joinClasses(
                    styles.stepItem,
                    item.active && styles.stepItemActive,
                    item.complete && styles.stepItemComplete,
                  )}
                >
                  <span className={styles.stepDot} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.sidebarBlock}>
            <p className={styles.sidebarLabel}>What you can do</p>
            <p className={styles.sidebarCopy}>
              View your bookings, messages, files, or team work without switching between different portals.
            </p>
          </div>
        </aside>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>
                {step === "role" ? "Choose access" : roleMeta?.kicker ?? "Secure access"}
              </p>
              <h1 className={styles.title}>
                {step === "role"
                  ? "Choose your workspace"
                  : step === "verify"
                    ? "Enter your code"
                    : `Sign in as ${roleMeta?.label ?? "User"}`}
              </h1>
              <p className={styles.description}>
                {step === "role"
                  ? "Pick the workspace you need. We’ll guide you through the right sign-in flow."
                  : step === "verify"
                    ? roleMeta?.codeHint
                    : roleMeta?.description}
              </p>
            </div>

            {step !== "role" ? (
              <button type="button" className={styles.secondaryButton} onClick={changeRole}>
                Change role
              </button>
            ) : null}
          </div>

          {step === "role" ? (
            <div className={styles.roleGrid}>
              {PUBLIC_LOGIN_ROLES.map((role) => {
                const meta = ROLE_META[role]

                return (
                  <button
                    key={role}
                    type="button"
                    className={styles.roleCard}
                    onClick={() => selectRole(role)}
                  >
                    <span className={styles.roleBadge}>{meta.label}</span>
                    <h2 className={styles.roleTitle}>{meta.label}</h2>
                    <p className={styles.roleSummary}>{meta.summary}</p>
                  </button>
                )
              })}
            </div>
          ) : null}

          {step === "details" && selectedRole ? (
            <form className={styles.form} onSubmit={handleDetailsSubmit}>
              <div className={styles.infoRow}>
                <span className={styles.roleBadge}>{roleMeta?.label}</span>
                <span className={styles.inlineCopy}>{roleMeta?.summary}</span>
              </div>

              {roleMeta?.allowName ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{roleMeta.nameLabel}</span>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Only needed if this is your first visit"
                    autoComplete="name"
                  />
                </label>
              ) : null}

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{roleMeta?.identifierLabel}</span>
                <input
                  className={styles.input}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="+91 98765 43210 or name@email.com"
                  autoComplete="username"
                />
              </label>

              {message ? <p className={styles.successText}>{message}</p> : null}
              {error ? <p className={styles.errorText}>{error}</p> : null}

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                  {isLoading ? "Sending code" : roleMeta?.sendLabel}
                </button>
              </div>
            </form>
          ) : null}

          {step === "verify" && selectedRole ? (
            <form className={styles.form} onSubmit={handleVerifySubmit}>
              <div className={styles.infoRow}>
                <span className={styles.roleBadge}>{roleMeta?.label}</span>
                <span className={styles.inlineCopy}>
                  Code sent to {sentTo || `your ${describeLoginIdentifier(identifier)}`}
                </span>
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Contact</span>
                <input className={styles.input} value={identifier} readOnly />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>One-time code</span>
                <input
                  className={styles.input}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoFocus
                />
              </label>

              {message ? <p className={styles.successText}>{message}</p> : null}
              {error ? <p className={styles.errorText}>{error}</p> : null}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => router.replace(buildLoginUrl(selectedRole, nextPath, "details", identifier))}
                >
                  Send a new code
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isLoading || !challengeId}
                >
                  {isLoading ? "Checking code" : "Open dashboard"}
                </button>
              </div>
            </form>
          ) : null}

          <div className={styles.panelFooter}>
            <span>Need help? Reach us on WhatsApp or phone and we’ll guide you.</span>
            {selectedRole ? (
              <Link href={getRoleLoginPath(selectedRole, nextPath)} className={styles.footerLink}>
                Refresh this step
              </Link>
            ) : (
              <Link href="/" className={styles.footerLink}>
                Back to home
              </Link>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
