export const sections = [
  {
    number: "01",
    title: "Introduction",
    content: "This Refund Policy outlines the terms and conditions governing cancellations, refunds, and rescheduling of services provided by The Indian Bar Company. By booking our services, the client agrees to this Refund Policy.",
    services: [
      { name: "Martini",      desc: "In-house party experiences"      },
      { name: "Negroni",      desc: "Pool party experiences"          },
      { name: "Cosmopolitan", desc: "Corporate office events"         },
      { name: "Bloody Mary",  desc: "Festival and large-scale events" },
    ],
  },
  {
    number: "02",
    title: "Booking and Advance Payment",
    items: [
      "A specified advance payment is required to confirm any booking.",
      "The advance amount secures the event date, initiates planning, and blocks vendor availability.",
      "All booking advances are strictly non-refundable, except where explicitly stated otherwise in writing.",
    ],
  },
  {
    number: "03",
    title: "Cancellation by Client",
    content: "In the event of cancellation by the Client, refunds (if applicable) shall be processed based on the following timelines:",
    tiers: [
      {
        label: "More than 30 days prior",
        tag: "50% eligible",
        items: [
          "Eligible for a refund of up to 50% of the total amount paid",
          "Subject to deduction of non-refundable advance",
          "Subject to deduction of costs already incurred for third-party vendors",
        ],
      },
      {
        label: "15 to 30 days prior",
        tag: "25% eligible",
        items: [
          "Eligible for a refund of up to 25% of the total amount paid",
          "Subject to applicable deductions as mentioned above",
        ],
      },
      {
        label: "Less than 15 days prior",
        tag: "No refund",
        items: [
          "No refund shall be provided, due to committed vendor costs and operational arrangements",
        ],
        danger: true,
      },
    ],
  },
  {
    number: "04",
    title: "Cancellation by the Company",
    content: "In the unlikely event that the Company cancels the booking:",
    items: [
      "The Client shall be entitled to a full refund of the amount paid, or",
      "The option to reschedule the event at no additional cost, subject to availability",
    ],
    footer: "The Company's liability shall be limited to the total amount received from the Client.",
  },
  {
    number: "05",
    title: "Third-Party Vendor Charges",
    items: [
      "The Company engages third-party vendors (e.g., caterers, decorators, DJs, venues, and equipment providers) for execution of services.",
      "Any payments made to such vendors on behalf of the Client are non-refundable once confirmed.",
      "Refunds, if any, will be processed only after deducting such non-recoverable expenses.",
    ],
  },
  {
    number: "06",
    title: "Rescheduling Policy",
    items: [
      "One-time rescheduling may be permitted if requested at least 15 days prior to the event date, subject to availability.",
      "Additional costs may apply due to changes in vendor pricing, logistics, or seasonal demand.",
      "Requests made less than 15 days prior may be treated as cancellations.",
    ],
  },
  {
    number: "07",
    title: "Non-Refundable Circumstances",
    content: "No refunds shall be issued under the following circumstances:",
    items: [
      "Change of mind after booking confirmation",
      "Client dissatisfaction based on subjective preferences",
      "Failure to provide required approvals, information, or payments on time",
      "Event disruption caused by Client or guests",
      "No-show or abandonment of the event",
    ],
  },
  {
    number: "08",
    title: "Force Majeure",
    content: "In the event of circumstances beyond the Company's control, including but not limited to:",
    items: [
      "Natural disasters",
      "Government restrictions or legal prohibitions",
      "Public health emergencies or pandemics",
      "Civil unrest or unforeseen disruptions",
    ],
    footer: "No refunds shall be guaranteed. However, the Company may, at its sole discretion, offer rescheduling options or issue a credit note for future use.",
  },
  {
    number: "09",
    title: "Refund Processing",
    items: [
      "Approved refunds will be processed within 7 to 14 working days from the date of confirmation.",
      "Refunds shall be issued via the original mode of payment, unless otherwise agreed.",
    ],
  },
  {
    number: "10",
    title: "Amendments",
    content: "The Company reserves the right to modify or update this Refund Policy at any time. Updated versions shall be effective upon publication on the Company's website.",
  },
]