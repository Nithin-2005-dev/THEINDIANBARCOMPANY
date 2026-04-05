import { renderEmailTemplate } from './email.templates';

describe('renderEmailTemplate', () => {
  it('renders a professional booking confirmation with dashboard access guidance', () => {
    const rendered = renderEmailTemplate('lead-confirmation', {
      subject: 'Thank you for your event request',
      variables: {
        clientName: 'Riya Malhotra',
        eventType: 'House Party',
        location: 'Bandra, Mumbai',
        eventDate: '2026-05-10',
        service: 'Signature Cocktail Service',
        leadId: 'lead-1',
        accessEmail: 'riya@example.com',
        accessPhone: '+919876543210',
        portalUrl:
          'https://example.com/login?role=client&next=%2Fdashboard%2Fevents%2Flead-1',
      },
    });

    expect(rendered.subject).toBe('Thank you for your event request');
    expect(rendered.text).toContain('Thank you, Riya Malhotra');
    expect(rendered.text).toContain('To access your client dashboard');
    expect(rendered.text).toContain('riya@example.com or +919876543210');
    expect(rendered.text).toContain('Next steps:');
    expect(rendered.text).toContain(
      'Client dashboard login: https://example.com/login?role=client&next=%2Fdashboard%2Fevents%2Flead-1',
    );
    expect(rendered.html).toContain('Open client dashboard');
  });

  it('renders a professional admin booking notification with workspace access', () => {
    const rendered = renderEmailTemplate('lead-admin-notification', {
      subject: 'New booking request: House Party',
      variables: {
        clientName: 'Riya Malhotra',
        eventType: 'House Party',
        location: 'Bandra, Mumbai',
        city: 'Mumbai',
        eventDate: '2026-05-10',
        service: 'Signature Cocktail Service',
        guestCount: '60',
        clientPhone: '+919876543210',
        clientEmail: 'riya@example.com',
        budgetRange: 'INR 60,000 - INR 1,20,000',
        addOns: 'Molecular cocktails',
        notes: 'Need a smoked-cocktail ritual at welcome hour.',
        leadId: 'lead-1',
        adminUrl:
          'https://example.com/login?role=admin&next=%2Fadmin%2Fchat%3FleadId%3Dlead-1%26conversationType%3DGROUP',
      },
    });

    expect(rendered.subject).toBe('New booking request: House Party');
    expect(rendered.text).toContain('A new booking request requires review.');
    expect(rendered.text).toContain('Open admin workspace:');
    expect(rendered.html).toContain('Open admin workspace');
    expect(rendered.html).toContain('Riya Malhotra');
  });
});
