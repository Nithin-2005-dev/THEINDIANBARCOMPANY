"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getBookingThemeDefinition } from "@/components/booking-theme/booking-theme"
import BookingWorkspaceHeader from "@/components/booking-workspace/BookingWorkspaceHeader/BookingWorkspaceHeader"
import StatusBadge from "@/components/admin/StatusBadge"
import {
  DashboardButton,
  DashboardPage,
  EmptyState,
  ErrorState,
  InlineNotice,
  Surface,
  WorkspaceTabs,
} from "@/components/dashboard/DashboardPrimitives"
import {
  ContractIcon,
  DocumentsIcon,
  MessagesIcon,
  OverviewIcon,
  PaymentsIcon,
  SparklesIcon,
  TimelineIcon,
} from "@/components/dashboard/icons"
import PortalShell from "@/components/portal/PortalShell"
import styles from "@/components/portal/EventDetailClient.module.css"
import {
  createEventMessageUploadUrl,
  createPaymentOrder,
  decideProposal,
  fetchPortalEvent,
  getContractDocumentAccessUrl,
  listContractVersions,
  PortalApiError,
  sendEventMessage,
  signContract,
  submitEventFeedback,
  verifyPayment,
} from "@/lib/client-portal"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type {
  PortalContractVersion,
  PortalEventDetailResponse,
} from "@/types/client-portal"

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
    }
  }
}

function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return "TBD"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function openExternalUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

function getContractStatusDescription(status?: string | null) {
  if (status === "SIGNED") return "Your signature is recorded and the agreement is locked for execution planning."
  if (status === "ARCHIVED") return "This agreement is archived for secure historical access and audit reference."
  if (status === "CANCELLED") return "This version is no longer active. Wait for our team to issue a revised agreement if needed."
  if (status === "DRAFT") return "The agreement is still being finalized internally and is not yet ready for signature."
  return "Review the latest version carefully, then sign digitally to confirm the event."
}

function getPaymentStatusDescription(status: string) {
  if (status === "PAID") return "Payment received successfully."
  if (status === "FAILED") return "The last payment attempt failed. You can try again when ready."
  if (status === "REFUNDED") return "This milestone has been refunded and remains in your audit trail."
  return "This milestone is pending payment."
}

async function loadRazorpayScript() {
  if (window.Razorpay) return

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."))
    document.body.appendChild(script)
  })
}

export default function EventDetailClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<PortalEventDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proposalComment, setProposalComment] = useState("")
  const [signatureName, setSignatureName] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)
  const [feedback, setFeedback] = useState({
    rating: 5,
    testimonial: "",
    comments: "",
    allowMediaUsage: false,
  })
  const [activeTab, setActiveTab] = useState("overview")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOpeningContract, setIsOpeningContract] = useState(false)
  const [contractVersions, setContractVersions] = useState<PortalContractVersion[] | null>(null)
  const [isLoadingContractVersions, setIsLoadingContractVersions] = useState(false)
  const [contractVersionsError, setContractVersionsError] = useState<string | null>(null)
  const hasDataRef = useRef(false)

  useEffect(() => {
    hasDataRef.current = data !== null
  }, [data])

  const reload = useCallback(
    async (options?: { background?: boolean }) => {
      const isBackground = Boolean(options?.background && hasDataRef.current)
      if (isBackground) setIsRefreshing(true)

      try {
        const nextData = await fetchPortalEvent(eventId)
        setData(nextData)
        setSignatureName(nextData.contract?.signedByName ?? "")
        setError(null)
      } catch (err) {
        setError(err instanceof PortalApiError ? err.message : "Unable to load event details.")
      } finally {
        setIsRefreshing(false)
      }
    },
    [eventId],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const intervalId = window.setInterval(() => void reload({ background: true }), 30000)
    return () => window.clearInterval(intervalId)
  }, [reload])

  const paymentDue = useMemo(
    () => data?.project?.payments.find((payment) => ["PENDING", "FAILED"].includes(payment.status)) ?? null,
    [data?.project?.payments],
  )
  const paidAmount = useMemo(
    () => (data?.project?.payments ?? []).filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + payment.amount, 0),
    [data?.project?.payments],
  )
  const outstandingAmount = useMemo(
    () => (data?.project?.payments ?? []).filter((payment) => ["PENDING", "FAILED"].includes(payment.status)).reduce((sum, payment) => sum + payment.amount, 0),
    [data?.project?.payments],
  )
  const contractLifecycle = useMemo(() => {
    const status = data?.contract?.status
    return [
      { label: "Issued", complete: status !== undefined && status !== "DRAFT" },
      { label: "Client review", complete: ["SENT", "SIGNED", "ARCHIVED"].includes(status ?? "") },
      { label: "Signed", complete: ["SIGNED", "ARCHIVED"].includes(status ?? "") },
      { label: "Archived", complete: status === "ARCHIVED" },
    ]
  }, [data?.contract?.status])
  const bookingTheme = useMemo(
    () =>
      getBookingThemeDefinition({
        eventType: data?.lead.eventType,
        packageLabel: data?.lead.packageLabel,
        packageName: data?.lead.packageName,
      }),
    [data?.lead.eventType, data?.lead.packageLabel, data?.lead.packageName],
  )
  const assistantPageState = useMemo(
    () => ({
      currentTab: activeTab,
      currentView: "event-detail",
      selectedBookingId: data?.lead.id ?? null,
      selectedProjectId: data?.project?.id ?? null,
      selectedContractId: data?.contract?.id ?? null,
      selectedPaymentId: paymentDue?.id ?? null,
      unreadChatCount: data?.messages.filter((message) => message.readAt == null).length ?? 0,
      overduePaymentCount: data?.project?.payments.filter((payment) => payment.dueDate ? new Date(payment.dueDate).getTime() < Date.now() && ["PENDING", "FAILED"].includes(payment.status) : false).length ?? 0,
      pendingPaymentCount: data?.project?.payments.filter((payment) => ["PENDING", "FAILED"].includes(payment.status)).length ?? 0,
      unsignedContractCount:
        data?.contract && ["DRAFT", "SENT"].includes(data.contract.status) ? 1 : 0,
      filters: {
        contractStatus: data?.contract?.status ?? null,
        paymentStatus: paymentDue?.status ?? null,
      },
    }),
    [
      activeTab,
      data?.contract?.id,
      data?.contract?.status,
      data?.lead.id,
      data?.messages,
      data?.project?.id,
      data?.project?.payments,
      paymentDue?.id,
      paymentDue?.status,
    ],
  )

  useAssistantPageState(assistantPageState)

  const tabs = [
    { id: "overview", label: "Overview", icon: OverviewIcon },
    { id: "timeline", label: "Timeline", icon: TimelineIcon },
    { id: "payments", label: "Payments", icon: PaymentsIcon },
    { id: "contracts", label: "Contracts", icon: ContractIcon },
    { id: "documents", label: "Documents", icon: DocumentsIcon },
    { id: "chat", label: "Chat", icon: MessagesIcon, badge: data?.messages.length || undefined },
    { id: "updates", label: "Updates", icon: SparklesIcon },
  ]

  const handlePay = async (paymentId: string) => {
    setActionError(null)
    try {
      const order = await createPaymentOrder(paymentId)
      await loadRazorpayScript()
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!key) throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.")

      const razorpay = new window.Razorpay!({
        key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.gatewayOrderId,
        name: "The Indian Bar Company",
        description: data?.lead.eventType ?? "Event payment",
        handler: async (response: Record<string, string>) => {
          await verifyPayment({
            paymentId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          await reload()
        },
        theme: { color: bookingTheme.accent },
      })

      razorpay.open()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to start payment.")
    }
  }

  const handleOpenSecureContract = async () => {
    if (!data?.contract) return
    setActionError(null)
    setIsOpeningContract(true)
    try {
      const access = await getContractDocumentAccessUrl(data.contract.id)
      openExternalUrl(access.url)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to open the contract securely.")
    } finally {
      setIsOpeningContract(false)
    }
  }

  const handleToggleContractVersions = async () => {
    if (!data?.contract) return
    if (contractVersions) {
      setContractVersions(null)
      setContractVersionsError(null)
      return
    }

    setIsLoadingContractVersions(true)
    setContractVersionsError(null)
    try {
      setContractVersions(await listContractVersions(data.contract.id))
    } catch (err) {
      setContractVersionsError(err instanceof Error ? err.message : "Unable to load revision history.")
    } finally {
      setIsLoadingContractVersions(false)
    }
  }

  const handleProposalDecision = async (status: "ACCEPTED" | "REJECTED") => {
    if (!data?.proposal) return
    setActionError(null)
    try {
      await decideProposal(data.proposal.id, {
        status,
        comment: proposalComment || undefined,
      })
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update proposal.")
    }
  }

  const handleSendMessage = async () => {
    if (!data?.lead.id || !messageBody.trim()) return
    setActionError(null)
    try {
      let attachmentPayload: { attachmentName?: string; attachmentKey?: string; attachmentUrl?: string } = {}
      if (messageAttachment) {
        const upload = await createEventMessageUploadUrl(data.lead.id, {
          fileName: messageAttachment.name,
          contentType: messageAttachment.type || "application/octet-stream",
          sizeBytes: messageAttachment.size,
        })
        await uploadFileToPresignedUrl(upload.url, messageAttachment)
        attachmentPayload = {
          attachmentName: messageAttachment.name,
          attachmentKey: upload.key,
          attachmentUrl: upload.fileUrl,
        }
      }

      await sendEventMessage(data.lead.id, {
        body: messageBody,
        ...attachmentPayload,
      })
      setMessageBody("")
      setMessageAttachment(null)
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to send message.")
    }
  }

  const handleSubmitFeedback = async () => {
    if (!data?.project) return
    setActionError(null)
    try {
      await submitEventFeedback(data.project.id, feedback)
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to submit feedback.")
    }
  }

  if (!data && error) {
    return (
      <PortalShell>
        <ErrorState title="Booking workspace unavailable" description={error} />
      </PortalShell>
    )
  }

  if (!data) {
    return (
      <PortalShell>
        <DashboardPage>
          <Surface title="Loading booking workspace" description="Preparing your booking controls.">
            <div className={styles.timelineList}>
              <div className={styles.summaryCard} />
              <div className={styles.summaryCard} />
            </div>
          </Surface>
        </DashboardPage>
      </PortalShell>
    )
  }

  const renderOverview = () => (
    <Surface title="Booking summary" description="Core scope, approvals, and event details in one place.">
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <p className={styles.summaryLabel}>Event brief</p>
          <p className={styles.value}>{data.lead.eventType} at {data.lead.location}</p>
          <p className={styles.copy}>{data.lead.notes ?? "Your team will keep adding milestone-specific notes here."}</p>
        </div>
        <div className={styles.detailCard}>
          <p className={styles.summaryLabel}>Coordinator</p>
          <p className={styles.value}>{data.coordinator?.name ?? "Assigning shortly"}</p>
          <p className={styles.copy}>{data.coordinator?.phone ?? data.coordinator?.email ?? "Your primary contact details will appear here."}</p>
        </div>
      </div>

      {data.proposal ? (
        <div className={styles.timelineList}>
          <div className={styles.timelineCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.summaryLabel}>Proposal</p>
                <h3 className={styles.headline}>{data.proposal.title}</h3>
              </div>
              <StatusBadge value={data.proposal.status} />
            </div>
            <p className={styles.value}>{formatCurrency(data.proposal.price)}</p>
            <p className={styles.copy}>{data.proposal.scope}</p>
            <p className={styles.helper}>{data.proposal.deliverables}</p>
            <p className={styles.meta}>Timeline | {data.proposal.timeline}</p>
            {data.proposal.status === "SENT" ? (
              <>
                <textarea className={styles.textArea} placeholder="Optional comment for your sales team" value={proposalComment} onChange={(event) => setProposalComment(event.target.value)} />
                <div className={styles.actionRow}>
                  <DashboardButton onClick={() => void handleProposalDecision("ACCEPTED")}>Accept proposal</DashboardButton>
                  <DashboardButton tone="secondary" onClick={() => void handleProposalDecision("REJECTED")}>Reject proposal</DashboardButton>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState title="Proposal will appear here" description="Once the commercial proposal is ready, you will be able to review pricing, scope, and accept or reject it from this workspace." />
      )}
    </Surface>
  )

  const renderTimeline = () => (
    <Surface title="Timeline" description="A running audit trail of milestones, notes, and system events.">
      {data.timeline.length ? (
        <div className={`${styles.timelineList} ${styles.scrollArea}`}>
          {data.timeline.map((item) => (
            <article key={item.id} className={styles.timelineCard}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.headline}>{item.title}</p>
                  <p className={styles.helper}>{item.actor?.name ?? item.actor?.role ?? item.type}</p>
                </div>
                <p className={styles.meta}>{formatDate(item.createdAt)}</p>
              </div>
              {item.body ? <p className={styles.copy}>{typeof item.body === "string" ? item.body : JSON.stringify(item.body)}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No timeline activity yet" description="Milestones and workflow changes will appear here as soon as your booking starts moving." />
      )}
    </Surface>
  )

  const renderPayments = () => (
    <Surface title="Payments" description="Milestones, status, receipts, and the next payable step.">
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}><p className={styles.summaryLabel}>Collected</p><p className={styles.summaryValue}>{formatCurrency(paidAmount)}</p></div>
        <div className={styles.summaryCard}><p className={styles.summaryLabel}>Outstanding</p><p className={styles.summaryValue}>{formatCurrency(outstandingAmount)}</p></div>
      </div>
      {(data.project?.payments.length ?? 0) ? (
        <div className={styles.paymentList}>
          {data.project?.payments.map((payment) => (
            <div key={payment.id} className={styles.paymentCard}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.headline}>{payment.type} milestone</p>
                  <p className={styles.helper}>Due {formatDate(payment.dueDate)}</p>
                </div>
                <StatusBadge value={payment.status} />
              </div>
              <p className={styles.value}>{formatCurrency(payment.amount, payment.currency)}</p>
              <p className={styles.copy}>{getPaymentStatusDescription(payment.status)}</p>
              <div className={styles.actionRow}>
                {payment.status !== "PAID" && payment.status !== "REFUNDED" ? (
                  <DashboardButton tone={payment.status === "FAILED" ? "danger" : "primary"} onClick={() => void handlePay(payment.id)}>
                    {payment.status === "FAILED" ? "Retry payment" : "Pay milestone"}
                  </DashboardButton>
                ) : null}
                {payment.receiptUrl ? <DashboardButton tone="secondary" onClick={() => openExternalUrl(payment.receiptUrl!)}>Open receipt</DashboardButton> : null}
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No payments scheduled yet" description="Milestone payments will show up here once the commercial workflow is ready." />}
    </Surface>
  )

  const renderContracts = () => (
    <Surface title="Contracts" description="Secure access, revision history, and digital acceptance.">
      {data.contract ? (
        <div className={styles.timelineList}>
          <div className={styles.timelineCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.summaryLabel}>Agreement status</p>
                <h3 className={styles.headline}>Digital contract workspace</h3>
              </div>
              <StatusBadge value={data.contract.status} />
            </div>
            <p className={styles.copy}>{getContractStatusDescription(data.contract.status)}</p>
            <div className={styles.stageGrid}>
              {contractLifecycle.map((step) => (
                <div key={step.label} className={`${styles.stage} ${step.complete ? styles.stageComplete : ""}`.trim()}>{step.label}</div>
              ))}
            </div>
            <div className={styles.actionRow}>
              <DashboardButton onClick={() => void handleOpenSecureContract()} disabled={isOpeningContract}>
                {isOpeningContract ? "Opening..." : "Open secure contract"}
              </DashboardButton>
              <DashboardButton tone="secondary" onClick={() => void handleToggleContractVersions()} disabled={isLoadingContractVersions}>
                {contractVersions ? "Hide revisions" : isLoadingContractVersions ? "Loading revisions..." : "View revisions"}
              </DashboardButton>
            </div>
          </div>
          {contractVersionsError ? <InlineNotice tone="error" title="Revision history unavailable" description={contractVersionsError} /> : null}
          {contractVersions?.length ? (
            <div className={styles.revisionList}>
              {contractVersions.map((version) => (
                <div key={version.id} className={styles.revisionCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.headline}>Version {version.version}</p>
                      <p className={styles.helper}>Uploaded by {version.uploadedByLabel} | {formatDate(version.createdAt)}</p>
                    </div>
                    {version.isCurrent ? <StatusBadge value="ACTIVE" /> : null}
                  </div>
                  <DashboardButton tone="secondary" onClick={() => openExternalUrl(version.accessUrl)}>Open revision</DashboardButton>
                </div>
              ))}
            </div>
          ) : null}
          {data.contract.status === "SENT" ? (
            <>
              <label className={styles.checkboxRow}>
                <span className={styles.checkboxLabel}>
                  <input type="checkbox" checked readOnly />
                  <span>I have reviewed the terms and accept the agreement for this event.</span>
                </span>
              </label>
              <input className={styles.field} placeholder="Type your full name" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
              <DashboardButton disabled={!signatureName.trim()} onClick={async () => {
                setActionError(null)
                try {
                  await signContract(data.contract!.id, { acceptedTerms: true, signerName: signatureName })
                  await reload()
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : "Unable to sign contract.")
                }
              }}>Sign contract</DashboardButton>
            </>
          ) : null}
        </div>
      ) : <EmptyState title="No contract yet" description="Your agreement will appear here once proposal approval is complete." />}
    </Surface>
  )

  const renderDocuments = () => {
    const receipts = (data.project?.payments ?? []).filter((payment) => payment.receiptUrl)
    return (
      <Surface title="Documents" description="Proposal files, contracts, and payment proof in one record.">
        <div className={styles.documentList}>
          {data.proposal?.documentUrl ? <div className={styles.documentCard}><p className={styles.headline}>Proposal PDF</p><p className={styles.copy}>Download the commercial proposal shared for this event.</p><DashboardButton tone="secondary" onClick={() => openExternalUrl(data.proposal!.documentUrl!)}>Open proposal</DashboardButton></div> : null}
          {data.contract ? <div className={styles.documentCard}><p className={styles.headline}>Secure contract</p><p className={styles.copy}>Open the latest contract version using a secure time-limited link.</p><DashboardButton tone="secondary" onClick={() => void handleOpenSecureContract()}>Open contract</DashboardButton></div> : null}
          {receipts.map((payment) => <div key={payment.id} className={styles.documentCard}><p className={styles.headline}>{payment.type} receipt</p><p className={styles.copy}>Payment proof recorded on {formatDate(payment.paidAt)}</p><DashboardButton tone="secondary" onClick={() => openExternalUrl(payment.receiptUrl!)}>Open receipt</DashboardButton></div>)}
          {!data.proposal?.documentUrl && !data.contract && !receipts.length ? <EmptyState title="No documents available yet" description="Proposal files, contract access, and receipts will show up here once they are generated." /> : null}
        </div>
      </Surface>
    )
  }

  const renderChat = () => (
    <Surface title="Booking chat" description="Keep approvals, attachments, and coordination in the same event workspace.">
      {!data.chat.canSend ? (
        <InlineNotice
          tone={data.chat.status === "CANCELLED" ? "error" : "warning"}
          title="Messaging closed"
          description={data.chat.readOnlyMessage ?? "This booking conversation is now read-only."}
        />
      ) : null}
      {data.messages.length ? (
        <div className={`${styles.messageList} ${styles.scrollArea}`}>
          {data.messages.map((message) => (
            <article key={message.id} className={styles.messageCard}>
              <div className={styles.messageHeader}>
                <div>
                  <p className={styles.headline}>{message.sender?.name || "System update"}</p>
                  <p className={styles.helper}>{message.sender?.role ?? message.type}</p>
                </div>
                <p className={styles.meta}>{formatDate(message.createdAt)}</p>
              </div>
              <p className={styles.messageBody}>{message.body}</p>
              <div className={styles.messageFooter}>
                {message.attachmentUrl ? <DashboardButton tone="secondary" onClick={() => openExternalUrl(message.attachmentUrl!)}>{message.attachmentName || "Open attachment"}</DashboardButton> : null}
                {message.readAt ? <p className={styles.meta}>Seen {formatDate(message.readAt)}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No messages yet" description="Start the conversation whenever you need support, confirmation, or clarification." />}
      <div className={styles.timelineList}>
        <textarea className={styles.textArea} placeholder={data.chat.canSend ? "Send a message to your coordinator or operations team" : data.chat.readOnlyMessage ?? "Messaging is unavailable for this booking."} value={messageBody} onChange={(event) => setMessageBody(event.target.value)} disabled={!data.chat.canSend} />
        <input type="file" className={styles.fileInput} onChange={(event) => setMessageAttachment(event.target.files?.[0] ?? null)} disabled={!data.chat.canSend} />
        <DashboardButton disabled={!data.chat.canSend || !messageBody.trim()} onClick={() => void handleSendMessage()}>Send message</DashboardButton>
      </div>
    </Surface>
  )

  const renderUpdates = () => (
    <Surface title="Updates" description="Recent motion on the booking plus post-event feedback when available.">
      <div className={styles.timelineList}>
        {data.timeline.slice(0, 4).map((item) => (
          <div key={item.id} className={styles.timelineCard}>
            <div className={styles.cardHeader}>
              <p className={styles.headline}>{item.title}</p>
              <p className={styles.meta}>{formatDate(item.createdAt)}</p>
            </div>
            {item.body ? <p className={styles.copy}>{typeof item.body === "string" ? item.body : JSON.stringify(item.body)}</p> : null}
          </div>
        ))}
        {data.project?.status === "COMPLETED" && !data.project.feedback ? (
          <>
            <input type="number" min={1} max={5} className={styles.field} value={feedback.rating} onChange={(event) => setFeedback((current) => ({ ...current, rating: Number(event.target.value) }))} />
            <textarea className={styles.textArea} placeholder="Testimonial" value={feedback.testimonial} onChange={(event) => setFeedback((current) => ({ ...current, testimonial: event.target.value }))} />
            <textarea className={styles.textArea} placeholder="Anything we can improve?" value={feedback.comments} onChange={(event) => setFeedback((current) => ({ ...current, comments: event.target.value }))} />
            <label className={styles.checkboxRow}>
              <span className={styles.checkboxLabel}>
                <input type="checkbox" checked={feedback.allowMediaUsage} onChange={(event) => setFeedback((current) => ({ ...current, allowMediaUsage: event.target.checked }))} />
                <span>You may use event media or testimonial excerpts for brand promotion.</span>
              </span>
            </label>
            <DashboardButton onClick={() => void handleSubmitFeedback()}>Submit feedback</DashboardButton>
          </>
        ) : null}
      </div>
    </Surface>
  )

  const section = activeTab === "timeline"
    ? renderTimeline()
    : activeTab === "payments"
      ? renderPayments()
      : activeTab === "contracts"
        ? renderContracts()
        : activeTab === "documents"
          ? renderDocuments()
          : activeTab === "chat"
            ? renderChat()
            : activeTab === "updates"
              ? renderUpdates()
              : renderOverview()

  return (
    <PortalShell>
      <DashboardPage>
        <BookingWorkspaceHeader
          actions={[
            ...(paymentDue
              ? [{ label: "Pay milestone", onClick: () => void handlePay(paymentDue.id), tone: "primary" as const }]
              : []),
            { label: "Open support chat", href: "/dashboard/chat", tone: "secondary" },
            ...(data.contract
              ? [{ label: "Open contract", onClick: () => void handleOpenSecureContract(), tone: "ghost" as const }]
              : []),
          ]}
          title={data.proposal?.title ?? data.lead.eventType}
          description={`${data.lead.eventType} at ${data.lead.location} on ${formatDate(data.lead.eventDate)}.`}
          eyebrow="Booking workspace"
          metaItems={[
            { label: "Status", value: data.lead.status.replaceAll("_", " ") },
            { label: "Coordinator", value: data.coordinator?.name ?? "Assigning shortly" },
            {
              label: "Budget",
              value: `${formatCurrency(data.lead.budgetMin ?? 0)} - ${formatCurrency(data.lead.budgetMax ?? 0)}`,
            },
            {
              label: "Next action",
              value: paymentDue
                ? `${paymentDue.type} milestone is ready`
                : "Review updates and keep your team aligned",
            },
          ]}
          status={data.lead.status}
        />

        {error ? (
          <InlineNotice tone="warning" title="Showing your last synced booking data" description={`${error} We are still refreshing this workspace in the background.`} />
        ) : null}
        {actionError ? <InlineNotice tone="error" title="Action needs attention" description={actionError} /> : null}

        <div className={styles.heroGrid}>
          <Surface title="Event command view" description="A shared summary of scope, progress, and delivery ownership.">
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}><p className={styles.summaryLabel}>Guests</p><p className={styles.summaryValue}>{data.lead.guestCount ?? "TBD"}</p></div>
              <div className={styles.summaryCard}><p className={styles.summaryLabel}>Package</p><p className={styles.summaryValue}>{data.lead.packageName || "Tailored package"}</p></div>
              <div className={styles.summaryCard}><p className={styles.summaryLabel}>Coordinator</p><p className={styles.summaryValue}>{data.coordinator?.name || "Assigning shortly"}</p></div>
              <div className={styles.summaryCard}><p className={styles.summaryLabel}>Budget</p><p className={styles.summaryValue}>{formatCurrency(data.lead.budgetMin ?? 0)} - {formatCurrency(data.lead.budgetMax ?? 0)}</p></div>
            </div>
            <div>
              <div className={styles.progressHeader}>
                <span className={styles.subtleLabel}>Execution progress</span>
                <span className={styles.meta}>{data.progress.percent}%</span>
              </div>
              <progress className={styles.progressBar} value={data.progress.percent} max={100} />
            </div>
            <div className={styles.stageGrid}>
              {data.progress.stages.map((stage) => <div key={stage.stage} className={`${styles.stage} ${stage.completed ? styles.stageComplete : ""}`.trim()}>{stage.stage.replaceAll("_", " ")}</div>)}
            </div>
          </Surface>

          <div className={styles.workspaceGrid}>
            <Surface title="Next action" description={paymentDue ? `${paymentDue.type} milestone of ${formatCurrency(paymentDue.amount, paymentDue.currency)} is ready.` : "No immediate action is pending from your side."}>
              <div className={styles.actionRow}>
                {paymentDue ? <DashboardButton onClick={() => void handlePay(paymentDue.id)}>Pay now</DashboardButton> : null}
                {isRefreshing ? <p className={styles.meta}>Refreshing in background</p> : null}
              </div>
            </Surface>
            <Surface title="Assigned vendors" description="Confirmed vendor visibility for this booking.">
              {data.project?.visibleVendors.length ? (
                <div className={styles.vendorList}>
                  {data.project.visibleVendors.map((vendor) => (
                    <div key={vendor.id} className={styles.vendorCard}>
                      <p className={styles.headline}>{vendor.name}</p>
                      <p className={styles.copy}>{vendor.serviceType}</p>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No vendors visible yet" description="Vendor assignments will appear here once the team confirms them for your event." />}
            </Surface>
          </div>
        </div>

        <Surface title="Workspace sections" description="Everything for this booking stays inside one operating view.">
          <WorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </Surface>

        {section}
      </DashboardPage>
    </PortalShell>
  )
}
