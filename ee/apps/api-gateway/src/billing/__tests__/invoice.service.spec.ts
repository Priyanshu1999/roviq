import { requestContext } from '@roviq/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceService } from '../reseller/invoice.service';

const TEST_CTX: import('@roviq/request-context').RequestContext = {
  userId: 'test-user-1',
  tenantId: 'tenant-1',
  resellerId: null,
  scope: 'institute',
  impersonatorId: null,
  correlationId: 'test',
};

function createMockInvoiceRepo() {
  return {
    nextInvoiceNumber: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    findByResellerId: vi.fn(),
  };
}

function createMockNats() {
  return { emit: vi.fn().mockReturnValue({ subscribe: vi.fn() }) };
}

function createService(
  repo: ReturnType<typeof createMockInvoiceRepo>,
  nats: ReturnType<typeof createMockNats>,
): InvoiceService {
  const svc = Object.create(InvoiceService.prototype) as InvoiceService;
  Object.assign(svc, { invoiceRepo: repo, natsClient: nats, logger: { warn: vi.fn() } });
  return svc;
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let repo: ReturnType<typeof createMockInvoiceRepo>;
  let nats: ReturnType<typeof createMockNats>;

  beforeEach(() => {
    repo = createMockInvoiceRepo();
    nats = createMockNats();
    service = createService(repo, nats);
  });

  describe('generateInvoice', () => {
    it('should generate invoice with 18% GST and correct amounts', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.nextInvoiceNumber.mockResolvedValue('RVQ-2026-00001');
        repo.create.mockImplementation((_rid: string, data: Record<string, unknown>) =>
          Promise.resolve({ id: 'inv-1', ...data }),
        );

        await service.generateInvoice('reseller-1', 'RVQ', {
          tenantId: 'tenant-1',
          subscriptionId: 'sub-1',
          planName: 'Pro',
          planAmountPaise: 100000n,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-01'),
        });

        // Plan amount: 100000 paise = ₹1000
        // GST: 18% of 100000 = 18000 paise
        // Total: 100000 + 18000 = 118000 paise
        expect(repo.create).toHaveBeenCalledWith(
          'reseller-1',
          expect.objectContaining({
            invoiceNumber: 'RVQ-2026-00001',
            subtotalAmount: 100000n,
            taxAmount: 18000n,
            totalAmount: 118000n,
            paidAmount: 0n,
            status: 'SENT',
          }),
        );

        // Check line items
        const createCall = repo.create.mock.calls[0][1];
        expect(createCall.lineItems).toHaveLength(1);
        expect(createCall.lineItems[0]).toEqual(
          expect.objectContaining({
            taxRate: 18,
            sacCode: '998393',
            unitAmountPaise: '100000',
            taxAmountPaise: '18000',
          }),
        );

        // Check tax breakdown
        expect(createCall.taxBreakdown).toEqual({
          gst: { rate: 18, amount: 18000, sacCode: '998393' },
        });
      }));

    it('should include proration credit as negative line item', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.nextInvoiceNumber.mockResolvedValue('RVQ-2026-00002');
        repo.create.mockImplementation((_rid, data) => Promise.resolve({ id: 'inv-2', ...data }));

        await service.generateInvoice('reseller-1', 'RVQ', {
          tenantId: 'tenant-1',
          subscriptionId: 'sub-1',
          planName: 'Pro',
          planAmountPaise: 100000n,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-01'),
          prorationCreditPaise: 30000,
        });

        const createCall = repo.create.mock.calls[0][1];
        expect(createCall.lineItems).toHaveLength(2);

        // Credit line item is negative
        const creditLine = createCall.lineItems[1];
        expect(creditLine.description).toContain('Proration credit');
        expect(Number(creditLine.totalAmountPaise)).toBe(-30000);
        expect(Number(creditLine.taxAmountPaise)).toBe(-5400); // 18% of 30000

        // Total = (100000 + 18000) + (-30000 + -5400) = 82600
        expect(Number(createCall.totalAmount)).toBe(82600);
      }));

    it('should set dueAt to 15 days after issue', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.nextInvoiceNumber.mockResolvedValue('RVQ-2026-00003');
        repo.create.mockImplementation((_rid, data) => Promise.resolve({ id: 'inv-3', ...data }));

        vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

        await service.generateInvoice('reseller-1', 'RVQ', {
          tenantId: 'tenant-1',
          subscriptionId: 'sub-1',
          planName: 'Pro',
          planAmountPaise: 50000n,
          periodStart: new Date('2026-03-01'),
          periodEnd: new Date('2026-04-01'),
        });

        const createCall = repo.create.mock.calls[0][1];
        const dueAt = new Date(createCall.dueAt);
        const issuedAt = new Date(createCall.issuedAt);
        const daysDiff = Math.round((dueAt.getTime() - issuedAt.getTime()) / 86_400_000);
        expect(daysDiff).toBe(15);

        vi.useRealTimers();
      }));
  });

  describe('markPaid', () => {
    it('should transition to PAID when fully paid', async () => {
      repo.findById.mockResolvedValue({ id: 'inv-1', paidAmount: 50000n, totalAmount: 100000n });
      await service.markPaid('reseller-1', 'inv-1', 50000n);

      expect(repo.updateStatus).toHaveBeenCalledWith(
        'reseller-1',
        'inv-1',
        expect.objectContaining({ status: 'PAID' }),
      );
    });

    it('should transition to PARTIALLY_PAID when not fully paid', async () => {
      repo.findById.mockResolvedValue({ id: 'inv-1', paidAmount: 0n, totalAmount: 100000n });
      await service.markPaid('reseller-1', 'inv-1', 30000n);

      expect(repo.updateStatus).toHaveBeenCalledWith(
        'reseller-1',
        'inv-1',
        expect.objectContaining({ status: 'PARTIALLY_PAID' }),
      );
    });
  });

  describe('markRefunded', () => {
    it('should transition to REFUNDED on full refund', async () => {
      repo.findById.mockResolvedValue({ id: 'inv-1', paidAmount: 100000n });
      await service.markRefunded('reseller-1', 'inv-1', 100000n);

      expect(repo.updateStatus).toHaveBeenCalledWith(
        'reseller-1',
        'inv-1',
        expect.objectContaining({ status: 'REFUNDED', paidAmount: 0n }),
      );
    });
  });
});
