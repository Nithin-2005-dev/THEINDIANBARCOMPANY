import { QueueService } from './queue.service';

describe('QueueService', () => {
  function createQueueMock() {
    return {
      add: jest.fn(),
      on: jest.fn(),
      getJob: jest.fn(),
      getJobCounts: jest.fn(async () => ({})),
    };
  }

  it('uses a BullMQ-safe custom job id for tracked email attempts', async () => {
    const otpQueue = createQueueMock();
    const notificationsQueue = createQueueMock();
    const paymentsQueue = createQueueMock();
    const vendorsQueue = createQueueMock();
    const remindersQueue = createQueueMock();
    const emailDeliveryService = {
      createQueuedEmail: jest.fn(),
      markQueueingFailed: jest.fn(),
      findForAdmin: jest.fn(),
    };

    const service = new QueueService(
      otpQueue as never,
      notificationsQueue as never,
      paymentsQueue as never,
      vendorsQueue as never,
      remindersQueue as never,
      emailDeliveryService as never,
    );

    await service.enqueueEmailAttempt(
      'delivery-123',
      {
        to: 'user@example.com',
        subject: 'Test email',
        template: 'otp-login',
      },
      2,
    );

    expect(notificationsQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.any(Object),
      expect.objectContaining({
        jobId: 'email-delivery-123-attempt-2',
      }),
    );
    expect(
      notificationsQueue.add.mock.calls[0][2].jobId.includes(':'),
    ).toBe(false);
  });
});
