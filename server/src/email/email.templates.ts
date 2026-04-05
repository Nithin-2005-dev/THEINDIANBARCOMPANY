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

function buildOrderedList(items: string[]) {
  const filteredItems = items.filter(Boolean);

  return {
    text: filteredItems
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n'),
    html: filteredItems
      .map(
        (item) =>
          `<li style="margin:0 0 10px;color:#d9d1bf;font-size:15px;line-height:1.7;">${escapeHtml(item)}</li>`,
      )
      .join(''),
  };
}

function buildLeadConfirmationEmail(
  input: EmailRenderInput,
  variables: Record<string, unknown>,
): RenderedEmail {
  const clientName = stringValue(variables.clientName);
  const eventType = stringValue(variables.eventType, 'your event');
  const location = stringValue(variables.location, 'your chosen venue');
  const eventDate = stringValue(variables.eventDate);
  const service = stringValue(variables.service);
  const leadId = stringValue(variables.leadId);
  const portalUrl = stringValue(variables.portalUrl);
  const accessEmail = stringValue(variables.accessEmail);
  const accessPhone = stringValue(variables.accessPhone);

  const loginMethods =
    accessEmail && accessPhone
      ? `${accessEmail} or ${accessPhone}`
      : accessEmail ||
        accessPhone ||
        'the same email address or phone number shared with your request';

  const nextSteps = [
    'Our concierge team reviews your brief, confirms availability, and checks the best service fit for your event.',
    'We prepare a tailored recommendation covering service format, staffing, and the right budget direction.',
    'We contact you on your preferred channel with the next step, proposal guidance, and planning support.',
  ];
  const orderedList = buildOrderedList(nextSteps);
  const summaryItems = [
    ['Event', eventType],
    ['Location', location],
    ['Event date', eventDate],
    ['Requested service', service],
    ['Reference', leadId],
  ].filter(([, value]) => Boolean(value));
  const summaryText = summaryItems
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
  const summaryHtml = summaryItems.length
    ? `
      <div style="margin:24px 0;padding:18px 20px;border:1px solid rgba(212,175,55,0.16);border-radius:20px;background:rgba(212,175,55,0.05);">
        ${summaryItems
          .map(
            ([label, value]) =>
              `<p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
          )
          .join('')}
      </div>
    `
    : '';

  const dashboardCopy = portalUrl
    ? `To access your client dashboard, open the secure link below and sign in using ${loginMethods}. We will send a one-time verification code to complete secure access.`
    : `To access your client dashboard, go to the Client login on our website and sign in using ${loginMethods}. We will send a one-time verification code to complete secure access.`;

  const paragraphs = [
    `Thank you${clientName ? `, ${clientName}` : ''}. We have received your booking request for ${eventType} at ${location}.`,
    'We appreciate the opportunity to support your event and our team is already reviewing the brief.',
    dashboardCopy,
    'Once you are in the client dashboard, you will be able to review updates, proposals, timelines, and the next actions for your booking.',
    'Thank you again for choosing The Indian Bar Company. We look forward to supporting you.',
  ];
  const heading = `Thank you${clientName ? `, ${clientName}` : ''}. Your booking request has been received`;

  return {
    subject: input.subject ?? 'Thank you for your event request',
    text: [
      heading,
      ...paragraphs,
      summaryText,
      'Next steps:',
      orderedList.text,
      portalUrl ? `Client dashboard login: ${portalUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: `
      <div style="background:#090807;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);backdrop-filter:blur(16px);border-radius:28px;padding:32px;">
          <p style="margin:0 0 8px;color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;">The Indian Bar Company</p>
          <h1 style="margin:0 0 20px;color:#f5f1e8;font-size:30px;line-height:1.2;font-weight:500;">${escapeHtml(heading)}</h1>
          ${paragraphs
            .map(
              (paragraph) =>
                `<p style="margin:0 0 16px;color:#d9d1bf;font-size:15px;line-height:1.7;">${escapeHtml(paragraph)}</p>`,
            )
            .join('')}
          ${summaryHtml}
          <div style="margin:24px 0;padding:20px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;background:rgba(255,255,255,0.03);">
            <p style="margin:0 0 10px;color:#d4af37;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">Next steps</p>
            <ol style="margin:0;padding-left:20px;">${orderedList.html}</ol>
          </div>
          ${
            portalUrl
              ? `<div style="margin-top:24px;"><a href="${escapeHtml(
                  portalUrl,
                )}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#d8b06a,#c58a36);color:#17130d;font-size:14px;font-weight:700;text-decoration:none;">Open client dashboard</a></div>`
              : ''
          }
        </div>
      </div>
    `,
  };
}

function buildLeadAdminNotificationEmail(
  input: EmailRenderInput,
  variables: Record<string, unknown>,
): RenderedEmail {
  const clientName = stringValue(variables.clientName, 'A client');
  const eventType = stringValue(variables.eventType, 'an event');
  const location = stringValue(variables.location, 'the selected location');
  const eventDate = stringValue(variables.eventDate, 'Not provided');
  const service = stringValue(variables.service, 'Not provided');
  const guestCount = stringValue(variables.guestCount, 'Not provided');
  const clientPhone = stringValue(variables.clientPhone, 'Not provided');
  const clientEmail = stringValue(variables.clientEmail, 'Not provided');
  const city = stringValue(variables.city, 'Not provided');
  const budgetRange = stringValue(variables.budgetRange, 'Not provided');
  const addOns = stringValue(variables.addOns, 'None selected');
  const notes = stringValue(variables.notes, 'No extra notes');
  const leadId = stringValue(variables.leadId);
  const adminUrl = stringValue(variables.adminUrl);

  const actionItems = buildOrderedList([
    'Open the booking workspace and review the brief details.',
    'Confirm the best service direction, availability, and internal ownership.',
    'Follow up with the client on the preferred channel with the next step.',
  ]);

  const summaryHtml = `
    <div style="margin:24px 0;padding:18px 20px;border:1px solid rgba(212,175,55,0.16);border-radius:20px;background:rgba(212,175,55,0.05);">
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Client:</strong> ${escapeHtml(clientName)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Event:</strong> ${escapeHtml(eventType)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Location:</strong> ${escapeHtml(location)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Event date:</strong> ${escapeHtml(eventDate)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Service:</strong> ${escapeHtml(service)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Guests:</strong> ${escapeHtml(guestCount)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Contact:</strong> ${escapeHtml(clientPhone)} | ${escapeHtml(clientEmail)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">City:</strong> ${escapeHtml(city)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Budget:</strong> ${escapeHtml(budgetRange)}</p>
      <p style="margin:0 0 10px;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Add-ons:</strong> ${escapeHtml(addOns)}</p>
      <p style="margin:0;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Notes:</strong> ${escapeHtml(notes)}</p>
      ${
        leadId
          ? `<p style="margin:10px 0 0;color:#f5f1e8;font-size:14px;line-height:1.6;"><strong style="color:#d4af37;">Lead reference:</strong> ${escapeHtml(leadId)}</p>`
          : ''
      }
    </div>
  `;

  return {
    subject: input.subject ?? `New booking request received: ${eventType}`,
    text: [
      'A new booking request requires review.',
      `${clientName} requested ${eventType} at ${location}.`,
      `Event date: ${eventDate}`,
      `Service: ${service}`,
      `Guests: ${guestCount}`,
      `Contact: ${clientPhone} | ${clientEmail}`,
      `City: ${city}`,
      `Budget: ${budgetRange}`,
      `Add-ons: ${addOns}`,
      `Notes: ${notes}`,
      leadId ? `Lead reference: ${leadId}` : '',
      'Recommended next actions:',
      actionItems.text,
      adminUrl ? `Open admin workspace: ${adminUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: `
      <div style="background:#090807;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);backdrop-filter:blur(16px);border-radius:28px;padding:32px;">
          <p style="margin:0 0 8px;color:#d4af37;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;">The Indian Bar Company</p>
          <h1 style="margin:0 0 20px;color:#f5f1e8;font-size:30px;line-height:1.2;font-weight:500;">A new booking request requires review</h1>
          <p style="margin:0 0 16px;color:#d9d1bf;font-size:15px;line-height:1.7;">${escapeHtml(clientName)} has submitted a new request for ${escapeHtml(eventType)} at ${escapeHtml(location)}.</p>
          ${summaryHtml}
          <div style="margin:24px 0;padding:20px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;background:rgba(255,255,255,0.03);">
            <p style="margin:0 0 10px;color:#d4af37;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">Recommended next actions</p>
            <ol style="margin:0;padding-left:20px;">${actionItems.html}</ol>
          </div>
          ${
            adminUrl
              ? `<div style="margin-top:24px;"><a href="${escapeHtml(
                  adminUrl,
                )}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#d8b06a,#c58a36);color:#17130d;font-size:14px;font-weight:700;text-decoration:none;">Open admin workspace</a></div>`
              : ''
          }
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
      return buildLeadConfirmationEmail(input, variables);
    case 'lead-admin-notification':
      return buildLeadAdminNotificationEmail(input, variables);
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
