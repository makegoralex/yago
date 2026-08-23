import {
  InventoryReceiptError,
  resolveInventoryAuditTimestamp,
} from '../inventory.service';

describe('inventory audit sequence', () => {
  const firstAudit = new Date('2026-08-23T09:00:00.000Z');

  it('allows another inventory audit later on the same day', () => {
    const secondAudit = new Date('2026-08-23T15:30:00.000Z');
    expect(resolveInventoryAuditTimestamp(secondAudit, firstAudit)).toEqual(secondAudit);
  });

  it('orders two audits submitted with the same displayed timestamp', () => {
    expect(resolveInventoryAuditTimestamp(firstAudit, firstAudit).getTime()).toBe(
      firstAudit.getTime() + 1
    );
  });

  it('rejects an audit earlier than the previous inventory audit', () => {
    expect(() =>
      resolveInventoryAuditTimestamp(new Date('2026-08-23T08:59:00.000Z'), firstAudit)
    ).toThrow(InventoryReceiptError);
  });
});
