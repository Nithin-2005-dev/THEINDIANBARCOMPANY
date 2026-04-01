import type { Prisma } from '@prisma/client';

type ProposalContext = Prisma.ProposalGetPayload<{
  include: {
    lead: {
      include: {
        client: true;
      };
    };
  };
}>;

type TemplateFieldConfig = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date';
  required?: boolean;
  helperText?: string;
  getDefaultValue: (context: ProposalContext) => string;
};

export type ContractTemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date';
  required: boolean;
  helperText?: string;
  value: string;
};

export type ContractTemplateMetadata = {
  id: string;
  name: string;
  description: string;
  supportsNativeSignature: boolean;
};

type ContractTemplateDefinition = ContractTemplateMetadata & {
  fields: TemplateFieldConfig[];
  render: (context: ProposalContext, values: Record<string, string>) => string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMultiline(value: string) {
  return escapeHtml(value).replaceAll('\n', '<br />');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function baseStyles() {
  return `
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, Helvetica, sans-serif;
        color: #0f172a;
      }
      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
      }
      .page {
        max-width: 960px;
        margin: 0 auto;
        padding: 48px 40px 80px;
        background: white;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 24px;
      }
      .eyebrow {
        margin: 0;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 10px 0 0;
        font-size: 34px;
        line-height: 1.1;
      }
      h2 {
        margin: 28px 0 12px;
        font-size: 18px;
      }
      p, li {
        font-size: 14px;
        line-height: 1.7;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 16px;
      }
      .label {
        margin: 0;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .value {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 600;
      }
      .section {
        margin-top: 28px;
      }
      .signature {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        margin-top: 40px;
      }
      .signature-box {
        min-height: 120px;
        border: 1px dashed #94a3b8;
        border-radius: 18px;
        padding: 16px;
      }
      .footer-note {
        margin-top: 32px;
        border-top: 1px solid #e2e8f0;
        padding-top: 16px;
        color: #475569;
        font-size: 12px;
      }
      @media print {
        body {
          background: white;
        }
        .page {
          padding: 20px;
        }
      }
    </style>
  `;
}

const templateDefinitions: ContractTemplateDefinition[] = [
  {
    id: 'event-service-standard',
    name: 'Standard Event Service Agreement',
    description:
      'Balanced contract for confirmed event bookings with staged payment terms and operational clauses.',
    supportsNativeSignature: true,
    fields: [
      {
        key: 'serviceWindow',
        label: 'Service window',
        type: 'text',
        required: true,
        helperText: 'Example: 5:00 PM to 11:30 PM on event day.',
        getDefaultValue: (context) =>
          `Event-day coverage on ${formatDate(context.lead.eventDate)} from setup to closeout.`,
      },
      {
        key: 'paymentTerms',
        label: 'Payment terms',
        type: 'textarea',
        required: true,
        getDefaultValue: (context) =>
          `Total contracted value: ${formatCurrency(context.price)}.\n50% advance to confirm the event.\nRemaining balance due before final execution closure.`,
      },
      {
        key: 'cancellationTerms',
        label: 'Cancellation terms',
        type: 'textarea',
        required: true,
        getDefaultValue: () =>
          'Advance payments are non-refundable once inventory, staffing, or vendors are committed. Date changes remain subject to availability and written approval.',
      },
      {
        key: 'specialTerms',
        label: 'Special terms',
        type: 'textarea',
        getDefaultValue: (context) =>
          context.notes?.trim() ||
          context.lead.notes?.trim() ||
          'No additional special terms recorded.',
      },
    ],
    render: (context, values) => `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(context.title)} Agreement</title>
          ${baseStyles()}
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div>
                <p class="eyebrow">The Indian Bar Company</p>
                <h1>Event Service Agreement</h1>
                <p>This agreement governs delivery of the confirmed event package for ${escapeHtml(context.title)}.</p>
              </div>
              <div>
                <p class="label">Agreement Ref</p>
                <p class="value">${escapeHtml(context.id.slice(0, 8).toUpperCase())}</p>
                <p class="label" style="margin-top: 14px;">Event Date</p>
                <p class="value">${escapeHtml(formatDate(context.lead.eventDate))}</p>
              </div>
            </section>

            <section class="grid">
              <div class="card">
                <p class="label">Client</p>
                <p class="value">${escapeHtml(context.lead.client.name || context.lead.client.email || context.lead.client.phone || 'Client')}</p>
              </div>
              <div class="card">
                <p class="label">Venue</p>
                <p class="value">${escapeHtml(context.lead.location)}</p>
              </div>
              <div class="card">
                <p class="label">Service Window</p>
                <p class="value">${escapeHtml(values.serviceWindow)}</p>
              </div>
              <div class="card">
                <p class="label">Quoted Value</p>
                <p class="value">${escapeHtml(formatCurrency(context.price))}</p>
              </div>
            </section>

            <section class="section">
              <h2>Scope of Services</h2>
              <p>${formatMultiline(context.scope)}</p>
            </section>

            <section class="section">
              <h2>Deliverables</h2>
              <p>${formatMultiline(context.deliverables)}</p>
            </section>

            <section class="section">
              <h2>Payment Terms</h2>
              <p>${formatMultiline(values.paymentTerms)}</p>
            </section>

            <section class="section">
              <h2>Cancellation and Rescheduling</h2>
              <p>${formatMultiline(values.cancellationTerms)}</p>
            </section>

            <section class="section">
              <h2>Special Terms</h2>
              <p>${formatMultiline(values.specialTerms)}</p>
            </section>

            <section class="signature">
              <div class="signature-box" data-signature-anchor="company">
                <p class="label">For The Indian Bar Company</p>
                <p>Authorized signatory</p>
              </div>
              <div class="signature-box" data-signature-anchor="client">
                <p class="label">For the Client</p>
                <p>Signed digitally in the client portal.</p>
              </div>
            </section>

            <p class="footer-note">
              This document is structured for native portal acceptance today and can be mapped to an external e-sign provider later using the signature anchors above.
            </p>
          </main>
        </body>
      </html>
    `,
  },
  {
    id: 'premium-execution-engagement',
    name: 'Premium Execution Agreement',
    description:
      'Detailed engagement letter for larger events with explicit staffing, revision, and delivery language.',
    supportsNativeSignature: true,
    fields: [
      {
        key: 'staffingCoverage',
        label: 'Staffing coverage',
        type: 'textarea',
        required: true,
        getDefaultValue: () =>
          'The Indian Bar Company will assign an operations lead and service crew aligned to the scale of the confirmed booking.',
      },
      {
        key: 'paymentTerms',
        label: 'Payment terms',
        type: 'textarea',
        required: true,
        getDefaultValue: (context) =>
          `Advance: 50% of ${formatCurrency(context.price)} at signing.\nMid-event billing if applicable.\nFinal payment before event closure or as otherwise scheduled in the portal.`,
      },
      {
        key: 'changeRequestTerms',
        label: 'Change request terms',
        type: 'textarea',
        required: true,
        getDefaultValue: () =>
          'Material scope changes requested after approval may change pricing, staffing, vendor commitments, or execution timelines and require written confirmation.',
      },
      {
        key: 'specialTerms',
        label: 'Special terms',
        type: 'textarea',
        getDefaultValue: (context) =>
          context.notes?.trim() ||
          context.lead.notes?.trim() ||
          'No additional premium execution notes recorded.',
      },
    ],
    render: (context, values) => `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(context.title)} Premium Engagement</title>
          ${baseStyles()}
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div>
                <p class="eyebrow">The Indian Bar Company</p>
                <h1>Premium Execution Agreement</h1>
                <p>For high-touch event planning and on-ground beverage execution.</p>
              </div>
              <div>
                <p class="label">Engagement Ref</p>
                <p class="value">${escapeHtml(context.id.slice(0, 8).toUpperCase())}</p>
                <p class="label" style="margin-top: 14px;">Prepared For</p>
                <p class="value">${escapeHtml(context.lead.client.name || 'Client')}</p>
              </div>
            </section>

            <section class="grid">
              <div class="card">
                <p class="label">Event</p>
                <p class="value">${escapeHtml(context.lead.eventType)}</p>
              </div>
              <div class="card">
                <p class="label">Venue</p>
                <p class="value">${escapeHtml(context.lead.location)}</p>
              </div>
              <div class="card">
                <p class="label">Timeline</p>
                <p class="value">${escapeHtml(context.timeline)}</p>
              </div>
              <div class="card">
                <p class="label">Commercial Value</p>
                <p class="value">${escapeHtml(formatCurrency(context.price))}</p>
              </div>
            </section>

            <section class="section">
              <h2>Execution Scope</h2>
              <p>${formatMultiline(context.scope)}</p>
            </section>

            <section class="section">
              <h2>Included Deliverables</h2>
              <p>${formatMultiline(context.deliverables)}</p>
            </section>

            <section class="section">
              <h2>Staffing and Operational Coverage</h2>
              <p>${formatMultiline(values.staffingCoverage)}</p>
            </section>

            <section class="section">
              <h2>Payment Structure</h2>
              <p>${formatMultiline(values.paymentTerms)}</p>
            </section>

            <section class="section">
              <h2>Change Requests and Revisions</h2>
              <p>${formatMultiline(values.changeRequestTerms)}</p>
            </section>

            <section class="section">
              <h2>Special Terms</h2>
              <p>${formatMultiline(values.specialTerms)}</p>
            </section>

            <section class="signature">
              <div class="signature-box" data-signature-anchor="company">
                <p class="label">For The Indian Bar Company</p>
                <p>Authorized signatory</p>
              </div>
              <div class="signature-box" data-signature-anchor="client">
                <p class="label">For the Client</p>
                <p>Accepted digitally using the portal signature flow.</p>
              </div>
            </section>

            <p class="footer-note">
              Signature anchors are included for portal signing today and future external e-sign integrations if required.
            </p>
          </main>
        </body>
      </html>
    `,
  },
];

export function listContractTemplateMetadata(): ContractTemplateMetadata[] {
  return templateDefinitions.map(
    ({ id, name, description, supportsNativeSignature }) => ({
      id,
      name,
      description,
      supportsNativeSignature,
    }),
  );
}

export function getTemplateDefinition(templateId: string) {
  return (
    templateDefinitions.find((template) => template.id === templateId) ?? null
  );
}

export function buildTemplateFields(
  template: ContractTemplateDefinition,
  context: ProposalContext,
  values?: Record<string, string>,
): ContractTemplateField[] {
  return template.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    helperText: field.helperText,
    value: values?.[field.key] ?? field.getDefaultValue(context),
  }));
}

export function renderTemplateDocument(
  template: ContractTemplateDefinition,
  context: ProposalContext,
  inputValues?: Record<string, string>,
) {
  const fields = buildTemplateFields(template, context, inputValues);
  const values = Object.fromEntries(
    fields.map((field) => [field.key, field.value]),
  );
  const title = `${template.name} - ${context.title}`;
  const suggestedFileName = `${slugify(context.title || context.lead.eventType || 'contract')}-${template.id}.html`;

  return {
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      supportsNativeSignature: template.supportsNativeSignature,
    },
    fields,
    title,
    suggestedFileName,
    html: template.render(context, values),
  };
}
