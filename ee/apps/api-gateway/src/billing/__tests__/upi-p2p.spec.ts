/**
 * UPI P2P Integration Tests
 *
 * Tests the full UPI P2P lifecycle: submit proof → verify/reject → expiry reversal.
 * Uses mocked repositories (not real DB) to test service-level integration.
 */
import { requestContext } from '@roviq/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../reseller/payment.service';

const TEST_CTX: import('@roviq/request-context').RequestContext = {
  userId: 'test-user-1',
  tenantId: 'tenant-1',
  resellerId: null,
  scope: 'institute',
  impersonatorId: null,
  correlationId: 'test',
};
const RESELLER_ID = 'reseller-1';
const INVOICE_ID = 'inv-1';
const TENANT_ID = 'tenant-1';

function createMocks() {
  const paymentRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findByInvoiceId: vi.fn(),
    findByTenantId: vi.fn(),
    findByGatewayOrderId: vi.fn(),
    findOrCreateByGatewayId: vi.fn(),
    findByUtrNumber: vi.fn(),
    findUnverified: vi.fn(),
    update: vi.fn(),
  };
  const invoiceRepo = {
    findById: vi.fn(),
    nextInvoiceNumber: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    findByResellerId: vi.fn(),
  };
  const invoiceService = {
    markPaid: vi.fn(),
    markRefunded: vi.fn(),
    generateInvoice: vi.fn(),
  };
  const subscriptionRepo = {
    findActiveByTenant: vi.fn(),
    update: vi.fn(),
  };
  const gatewayFactory = { create: vi.fn() };
  const config = { getOrThrow: vi.fn(), get: vi.fn() };
  const eventBus = { emit: vi.fn() };

  const service = Object.create(PaymentService.prototype) as PaymentService;
  Object.assign(service, {
    paymentRepo,
    invoiceRepo,
    invoiceService,
    subscriptionRepo,
    gatewayFactory,
    config,
    eventBus,
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });

  return { service, paymentRepo, invoiceRepo, invoiceService, subscriptionRepo, eventBus };
}

describe('UPI P2P Integration — Full Lifecycle', () => {
  let ctx: ReturnType<typeof createMocks>;

  beforeEach(() => {
    ctx = createMocks();
  });

  describe('Submit → Verify (happy path)', () => {
    it('should submit proof then verify successfully', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, paymentRepo, invoiceRepo, invoiceService, subscriptionRepo } = ctx;

        // --- SUBMIT ---
        invoiceRepo.findById.mockResolvedValue({
          id: INVOICE_ID,
          tenantId: TENANT_ID,
          totalAmount: 118000n,
          paidAmount: 0n,
          currency: 'INR',
          status: 'SENT',
        });
        paymentRepo.findByUtrNumber.mockResolvedValue(null);
        paymentRepo.create.mockResolvedValue({
          id: 'pay-1',
          method: 'UPI_P2P',
          status: 'SUCCEEDED',
          verificationStatus: 'PENDING_VERIFICATION',
          amountPaise: 118000n,
        });
        subscriptionRepo.findActiveByTenant.mockResolvedValue(null);

        const submitted = await service.submitUpiProof(
          RESELLER_ID,
          INVOICE_ID,
          '123456789012',
          'member-1',
        );
        expect(submitted.verificationStatus).toBe('PENDING_VERIFICATION');
        expect(invoiceService.markPaid).toHaveBeenCalledWith(RESELLER_ID, INVOICE_ID, 118000n);

        // --- VERIFY ---
        paymentRepo.findById.mockResolvedValue({
          id: 'pay-1',
          verificationStatus: 'PENDING_VERIFICATION',
        });
        paymentRepo.update.mockResolvedValue({
          id: 'pay-1',
          verificationStatus: 'VERIFIED',
          verifiedById: 'verifier-member',
        });

        const verified = await service.verifyUpiPayment(RESELLER_ID, 'pay-1', 'verifier-member');
        expect(verified.verificationStatus).toBe('VERIFIED');
        expect(verified.verifiedById).toBe('verifier-member');
      }));
  });

  describe('Submit → Reject (full reversal)', () => {
    it('should submit proof then reject with full reversal', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, paymentRepo, invoiceRepo, invoiceService, subscriptionRepo } = ctx;

        // --- SUBMIT with PAST_DUE subscription ---
        invoiceRepo.findById
          .mockResolvedValueOnce({
            id: INVOICE_ID,
            tenantId: TENANT_ID,
            totalAmount: 118000n,
            paidAmount: 0n,
            currency: 'INR',
            status: 'OVERDUE',
          })
          // After reject, invoice status reverted
          .mockResolvedValueOnce({ id: INVOICE_ID, status: 'OVERDUE' });

        paymentRepo.findByUtrNumber.mockResolvedValue(null);
        paymentRepo.create.mockResolvedValue({
          id: 'pay-1',
          method: 'UPI_P2P',
          status: 'SUCCEEDED',
          verificationStatus: 'PENDING_VERIFICATION',
          amountPaise: 118000n,
          invoiceId: INVOICE_ID,
          tenantId: TENANT_ID,
        });
        subscriptionRepo.findActiveByTenant
          .mockResolvedValueOnce({ id: 'sub-1', status: 'PAST_DUE' }) // submit: reactivate
          .mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE' }); // reject: revert

        await service.submitUpiProof(RESELLER_ID, INVOICE_ID, '123456789012', 'member-1');

        // Verify subscription was reactivated on submit (trust-first)
        expect(subscriptionRepo.update).toHaveBeenCalledWith(RESELLER_ID, 'sub-1', {
          status: 'ACTIVE',
        });

        // --- REJECT ---
        paymentRepo.findById.mockResolvedValue({
          id: 'pay-1',
          invoiceId: INVOICE_ID,
          tenantId: TENANT_ID,
          amountPaise: 118000n,
          verificationStatus: 'PENDING_VERIFICATION',
        });
        paymentRepo.update.mockResolvedValue({
          id: 'pay-1',
          status: 'FAILED',
          verificationStatus: 'REJECTED',
        });

        await service.rejectUpiPayment(RESELLER_ID, 'pay-1', 'UTR not found in bank statement');

        // Invoice reversed
        expect(invoiceService.markRefunded).toHaveBeenCalledWith(RESELLER_ID, INVOICE_ID, 118000n);
        // Subscription reverted to PAST_DUE
        expect(subscriptionRepo.update).toHaveBeenCalledWith(RESELLER_ID, 'sub-1', {
          status: 'PAST_DUE',
        });
        // Payment marked FAILED + REJECTED
        expect(paymentRepo.update).toHaveBeenCalledWith(
          RESELLER_ID,
          'pay-1',
          expect.objectContaining({
            status: 'FAILED',
            verificationStatus: 'REJECTED',
            failureReason: 'UTR not found in bank statement',
          }),
        );
      }));
  });

  describe('Submit — edge cases', () => {
    it('should reject non-payable invoice status', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, invoiceRepo } = ctx;
        invoiceRepo.findById.mockResolvedValue({
          status: 'PAID',
          totalAmount: 118000n,
          paidAmount: 118000n,
        });

        await expect(
          service.submitUpiProof(RESELLER_ID, INVOICE_ID, '123456789012', 'member-1'),
        ).rejects.toThrow();
      }));

    it('should reject UTR shorter than 12 digits', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, invoiceRepo } = ctx;
        invoiceRepo.findById.mockResolvedValue({
          status: 'SENT',
          totalAmount: 118000n,
          paidAmount: 0n,
        });

        await expect(
          service.submitUpiProof(RESELLER_ID, INVOICE_ID, '12345', 'member-1'),
        ).rejects.toThrow();
      }));

    it('should reject UTR with non-digit characters', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, invoiceRepo } = ctx;
        invoiceRepo.findById.mockResolvedValue({
          status: 'SENT',
          totalAmount: 118000n,
          paidAmount: 0n,
        });

        await expect(
          service.submitUpiProof(RESELLER_ID, INVOICE_ID, 'ABC456789012', 'member-1'),
        ).rejects.toThrow();
      }));

    it('should reject duplicate UTR number', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, invoiceRepo, paymentRepo } = ctx;
        invoiceRepo.findById.mockResolvedValue({
          status: 'SENT',
          totalAmount: 118000n,
          paidAmount: 0n,
        });
        paymentRepo.findByUtrNumber.mockResolvedValue({ id: 'existing-pay-1' });

        await expect(
          service.submitUpiProof(RESELLER_ID, INVOICE_ID, '123456789012', 'member-1'),
        ).rejects.toThrow();
      }));
  });

  describe('Verify/Reject — edge cases', () => {
    it('should not allow verifying already-verified payment', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, paymentRepo } = ctx;
        paymentRepo.findById.mockResolvedValue({ verificationStatus: 'VERIFIED' });

        await expect(service.verifyUpiPayment(RESELLER_ID, 'pay-1', 'member-1')).rejects.toThrow();
      }));

    it('should not allow rejecting already-rejected payment', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, paymentRepo } = ctx;
        paymentRepo.findById.mockResolvedValue({ verificationStatus: 'REJECTED' });

        await expect(
          service.rejectUpiPayment(RESELLER_ID, 'pay-1', 'Duplicate reject'),
        ).rejects.toThrow();
      }));

    it('should not revert subscription if invoice is still PAID after reject', () =>
      requestContext.run(TEST_CTX, async () => {
        const { service, paymentRepo, invoiceRepo, subscriptionRepo } = ctx;
        paymentRepo.findById.mockResolvedValue({
          id: 'pay-1',
          invoiceId: INVOICE_ID,
          tenantId: TENANT_ID,
          amountPaise: 50000n,
          verificationStatus: 'PENDING_VERIFICATION',
        });
        // After reversal, invoice is still PAID (other payments cover it)
        invoiceRepo.findById.mockResolvedValue({ id: INVOICE_ID, status: 'PAID' });
        paymentRepo.update.mockResolvedValue({});

        await service.rejectUpiPayment(RESELLER_ID, 'pay-1', 'Not found');

        // Subscription should NOT be reverted since invoice is still paid
        expect(subscriptionRepo.update).not.toHaveBeenCalled();
      }));
  });
});
