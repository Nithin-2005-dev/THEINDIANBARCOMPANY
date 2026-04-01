type EmailRenderInput = {
  subject?: string;
  variables?: Record<string, unknown>;
};

type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function stringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return fallback;
}

function escapeHtml(value: unknown) {
  return stringValue(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value: unknown) {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;

  if (!Number.isFinite(amount)) {
    return stringValue(value);
  }

  return `INR ${new Intl.NumberFormat('en-IN').format(amount)}`;
}

function buildEmail(
  subject: string,
  heading: string,
  paragraphs: string[],
): RenderedEmail {
  const htmlParagraphs = paragraphs
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#d9d1bf;font-size:15px;line-height:1.7;">${escapeHtml(paragraph)}</p>`,
    )
    .join('');

  return {
    subject,
    text: [heading, ...paragraphs].filter(Boolean).join('\n\n'),
    html: `
      <div style="background:#090807;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);backdrop-filter:blur(16px);border-radius:28px;padding:32px;">
          <p style="margin:0 0 8px;color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;">The Indian Bar Company</p>
          <h1 style="margin:0 0 20px;color:#f5f1e8;font-size:30px;line-height:1.2;font-weight:500;">${escapeHtml(heading)}</h1>
          ${htmlParagraphs}
        </div>
      </div>
    `,
  };
}

export function renderEmailTemplate(
  template: string,
  input: EmailRenderInput,
): RenderedEmail {
  const variables = input.variables ?? {};
  const value = (key: string, fallback = '') =>
    stringValue(variables[key], fallback);

  switch (template) {
    case 'otp-login':
      return buildEmail(
        input.subject ?? 'Your login OTP',
        'Your verification code is ready',
        [
          `Use OTP ${value('otp', '******')} to complete your sign-in.`,
          `This code expires in ${value('expiryMinutes', '5')} minutes and can be used only once.`,
        ],
      );
    case 'lead-confirmation':
      return buildEmail(
        input.subject ?? 'Your event request is in',
        'Your event brief has been received',
        [
          `We have captured your request for ${value('eventType', 'your event')} at ${value('location', 'your chosen venue')}.`,
          variables.eventDate
            ? `Planned event date: ${value('eventDate')}.`
            : '',
          variables.service ? `Requested service: ${value('service')}.` : '',
          'Our team will now shape the right proposal, staffing, and bar plan for your date.',
          variables.leadId ? `Booking reference: ${value('leadId')}.` : '',
        ],
      );
    case 'lead-admin-notification':
      return buildEmail(
        input.subject ?? 'New booking request received',
        'A new client booking just came in',
        [
          `${value('clientName', 'A client')} requested ${value('eventType', 'an event')} at ${value('location', 'the selected location')}.`,
          `Event date: ${value('eventDate', 'Not provided')} | Service: ${value('service', 'Not provided')} | Guests: ${value('guestCount', 'Not provided')}.`,
          `Client contact: ${value('clientPhone', 'Not provided')}${variables.clientEmail ? ` | ${value('clientEmail')}` : ''}.`,
          `City: ${value('city', 'Not provided')} | Budget: ${value('budgetRange', 'Not provided')}.`,
          `Add-ons: ${value('addOns', 'None selected')}.`,
          `Notes: ${value('notes', 'No extra notes')}.`,
          variables.leadId ? `Lead reference: ${value('leadId')}.` : '',
        ],
      );
    case 'proposal-sent':
      return buildEmail(
        input.subject ?? 'Proposal ready for review',
        'Your proposal is ready',
        [
          `${value('title', 'Your proposal')} is ready for ${value('eventType', 'your event')}.`,
          variables.amount
            ? `Quoted amount: ${formatCurrency(variables.amount)}.`
            : '',
          variables.eventDate
            ? `Planned event date: ${value('eventDate')}.`
            : '',
          variables.timeline ? `Timeline: ${value('timeline')}.` : '',
          'Review the pricing, scope, and timeline in the client portal, then accept it or request changes.',
          variables.loginIdentifier
            ? `Sign in with ${value('loginIdentifier')} and use the one-time verification code to access your portal securely.`
            : 'Use your client portal verification code to access the proposal securely.',
          variables.portalUrl
            ? `Open your client portal: ${value('portalUrl')}`
            : '',
        ],
      );
    case 'proposal-accepted':
      return buildEmail(
        input.subject ?? 'Proposal accepted',
        'Proposal accepted successfully',
        [
          'Thank you for approving the proposal.',
          'Our team will move ahead with contract preparation and event planning.',
        ],
      );
    case 'proposal-rejected':
      return buildEmail(
        input.subject ?? 'Proposal decision received',
        'Proposal declined',
        [
          'We recorded your decision and our team can help revise the scope if needed.',
          variables.comment ? `Client note: ${value('comment')}` : '',
        ],
      );
    case 'contract-ready':
      return buildEmail(
        input.subject ?? 'Contract ready for signature',
        'Your contract is ready',
        [
          'Review the agreement in your dashboard and sign digitally to confirm your event.',
          variables.title ? `Linked proposal: ${value('title')}` : '',
        ],
      );
    case 'contract-signed':
      return buildEmail(
        input.subject ?? 'Contract signed',
        'Contract signed successfully',
        [
          `We recorded the signature for ${value('signerName', 'your contract')}.`,
          'Operations planning is now moving forward.',
        ],
      );
    case 'payment-receipt':
      return buildEmail(
        input.subject ?? 'Payment received',
        'Payment received',
        [
          `We received your ${value('paymentType', 'event')} payment of ${value('amount')}.`,
          'You can review the updated payment status and receipt from your dashboard.',
        ],
      );
    case 'payment-reminder':
      return buildEmail(
        input.subject ?? 'Payment reminder',
        'A payment milestone is coming up',
        [
          `Your ${value('paymentType', 'event')} payment of ${value('amount')} is due ${value('dueDate', 'soon')}.`,
          'Complete the payment in your dashboard to keep planning on track.',
        ],
      );
    case 'project-update':
      return buildEmail(
        input.subject ?? 'Project update',
        'A new event update has been posted',
        [
          `${value('title', 'A new milestone')} has been added to your event timeline.`,
          variables.body
            ? value('body')
            : 'Open your dashboard to review the latest coordination update.',
        ],
      );
    case 'event-reminder':
      return buildEmail(
        input.subject ?? 'Event reminder',
        'Your event is approaching',
        [
          variables.eventDate
            ? `Your event is scheduled for ${value('eventDate')}.`
            : 'Your event date is coming up soon.',
          'Visit the dashboard to review final staffing, timelines, and pending actions.',
        ],
      );
    case 'feedback-request':
      return buildEmail(
        input.subject ?? 'Tell us about your event',
        'We would love your feedback',
        [
          'Thank you for celebrating with The Indian Bar Company.',
          'Please share your rating and testimonial in the dashboard when you have a moment.',
        ],
      );
    default:
      return buildEmail(
        input.subject ?? 'The Indian Bar Company update',
        input.subject ?? 'Platform update',
        [
          typeof variables.message === 'string'
            ? variables.message
            : 'There is a new update waiting for you in the platform.',
        ],
      );
  }
}
