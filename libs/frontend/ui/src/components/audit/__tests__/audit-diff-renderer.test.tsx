import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditDiffRenderer } from '../audit-diff-renderer';

afterEach(cleanup);

describe('AuditDiffRenderer', () => {
  // ── Core rendering modes ──────────────────────────────

  describe('UPDATE mode', () => {
    it('renders old (red) → new (green) for each changed field', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            name: { old: 'Raj', new: 'Rajesh' },
            email: { old: 'raj@test.com', new: 'rajesh@test.com' },
          }}
        />,
      );

      expect(screen.getByText('name')).toBeDefined();
      expect(screen.getByText('Raj')).toBeDefined();
      expect(screen.getByText('Rajesh')).toBeDefined();
      expect(screen.getByText('email')).toBeDefined();
      expect(screen.getAllByText('→').length).toBe(2);
    });

    it('shows arrow separator between old and new columns', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{ status: { old: 'ACTIVE', new: 'SUSPENDED' } }}
        />,
      );

      expect(screen.getByText('→')).toBeDefined();
    });
  });

  describe('CREATE mode', () => {
    it('renders only new values (all green), no old column or arrow', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            name: { old: null, new: 'New Student' },
            grade: { old: null, new: '10th' },
          }}
        />,
      );

      expect(screen.getByText('New Student')).toBeDefined();
      expect(screen.getByText('10th')).toBeDefined();
      expect(screen.queryByText('→')).toBeNull();
    });
  });

  describe('DELETE mode', () => {
    it('starts collapsed showing field count, expands on click', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{
            name: { old: 'Deleted Student', new: null },
            email: { old: 'del@test.com', new: null },
          }}
        />,
      );

      // Initially collapsed
      expect(screen.getByText('2 fields deleted')).toBeDefined();
      expect(screen.queryByText('Deleted Student')).toBeNull();

      // Expand
      fireEvent.click(screen.getByText('2 fields deleted'));

      expect(screen.getByText('Deleted Student')).toBeDefined();
      expect(screen.getByText('del@test.com')).toBeDefined();
    });

    it('uses singular "1 field deleted" for single field', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{ name: { old: 'Only Field', new: null } }}
        />,
      );

      expect(screen.getByText('1 field deleted')).toBeDefined();
    });

    it('collapses back when clicking the header after expanding', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{
            name: { old: 'Student', new: null },
            email: { old: 's@test.com', new: null },
          }}
        />,
      );

      // Expand
      fireEvent.click(screen.getByText('2 fields deleted'));
      expect(screen.getByText('Student')).toBeDefined();

      // Collapse via "Deleted entity snapshot" header
      fireEvent.click(screen.getByText('Deleted entity snapshot'));
      expect(screen.queryByText('Student')).toBeNull();
      expect(screen.getByText('2 fields deleted')).toBeDefined();
    });

    it('shows only old values, no new column or arrow', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{ status: { old: 'ACTIVE', new: null } }}
        />,
      );

      fireEvent.click(screen.getByText('1 field deleted'));

      expect(screen.getByText('ACTIVE')).toBeDefined();
      expect(screen.queryByText('→')).toBeNull();
    });
  });

  // ── Empty / null states ───────────────────────────────

  describe('empty states', () => {
    it('renders empty state for null changes', () => {
      render(<AuditDiffRenderer actionType="UPDATE" changes={null} />);
      expect(screen.getByText('No changes recorded')).toBeDefined();
    });

    it('renders empty state for empty changes object', () => {
      render(<AuditDiffRenderer actionType="UPDATE" changes={{}} />);
      expect(screen.getByText('No changes recorded')).toBeDefined();
    });

    it('renders null old/new values as em-dash', () => {
      render(
        <AuditDiffRenderer actionType="UPDATE" changes={{ field: { old: null, new: 'value' } }} />,
      );
      expect(screen.getByText('—')).toBeDefined();
    });

    it('renders undefined values as em-dash', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{ field: { old: undefined as unknown, new: 'set' } }}
        />,
      );
      expect(screen.getByText('—')).toBeDefined();
    });
  });

  // ── REDACTED values ───────────────────────────────────

  describe('[REDACTED] handling', () => {
    it('renders [REDACTED] badge for masked fields', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            name: { old: 'Raj', new: 'Rajesh' },
            password: { old: '[REDACTED]', new: '[REDACTED]' },
          }}
        />,
      );

      const redactedElements = screen.getAllByText('[REDACTED]');
      expect(redactedElements.length).toBe(2);
      expect(screen.getByText('Raj')).toBeDefined();
    });

    it('handles mixed redacted and normal values in same row', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            secret: { old: '[REDACTED]', new: 'now-visible' },
          }}
        />,
      );

      expect(screen.getByText('[REDACTED]')).toBeDefined();
      expect(screen.getByText('now-visible')).toBeDefined();
    });

    it('does not treat similar strings as redacted', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            note: { old: null, new: '[REDACTED] info' },
          }}
        />,
      );

      // Not a badge — rendered as normal text value
      expect(screen.getByText('[REDACTED] info')).toBeDefined();
    });
  });

  // ── Primitive type formatting ─────────────────────────

  describe('primitive value formatting', () => {
    it('renders boolean values as "true"/"false" strings', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            isMandatory: { old: false, new: true },
          }}
        />,
      );

      expect(screen.getByText('false')).toBeDefined();
      expect(screen.getByText('true')).toBeDefined();
    });

    it('renders number values', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            theoryMarks: { old: 80, new: 100 },
            price: { old: 0, new: 999 },
          }}
        />,
      );

      expect(screen.getByText('80')).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
      expect(screen.getByText('0')).toBeDefined();
      expect(screen.getByText('999')).toBeDefined();
    });

    it('renders empty string values (not as em-dash)', () => {
      render(
        <AuditDiffRenderer actionType="UPDATE" changes={{ note: { old: 'had value', new: '' } }} />,
      );

      expect(screen.getByText('had value')).toBeDefined();
      // Empty string renders as empty <pre>, not em-dash
      expect(screen.queryAllByText('—').length).toBe(0);
    });
  });

  // ── Array handling ────────────────────────────────────

  describe('array values', () => {
    it('renders simple arrays as comma-separated values', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            tags: { old: null, new: ['math', 'science', 'english'] },
          }}
        />,
      );

      expect(screen.getByText('math, science, english')).toBeDefined();
    });

    it('renders empty array without crashing', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{ abilities: { old: ['read'], new: [] } }}
        />,
      );

      expect(screen.getByText('read')).toBeDefined();
      // Empty array formats as empty string
    });

    it('renders array of numbers', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{ scores: { old: [70, 80], new: [85, 90, 95] } }}
        />,
      );

      expect(screen.getByText('70, 80')).toBeDefined();
      expect(screen.getByText('85, 90, 95')).toBeDefined();
    });

    it('renders array with mixed types', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            mixed: { old: null, new: ['text', 42, true, null] },
          }}
        />,
      );

      expect(screen.getByText('text, 42, true, —')).toBeDefined();
    });
  });

  // ── Nested objects ────────────────────────────────────

  describe('nested and deeply nested objects', () => {
    it('renders shallow nested object as formatted JSON', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            address: { old: null, new: { city: 'Delhi', state: 'DL' } },
          }}
        />,
      );

      expect(screen.getByText(/Delhi/)).toBeDefined();
      expect(screen.getByText(/DL/)).toBeDefined();
    });

    it('renders deeply nested object (3+ levels) as formatted JSON', () => {
      const deepObject = {
        contact: {
          primary: {
            phone: '+91-9876543210',
            address: {
              line1: '42 MG Road',
              city: 'Jaipur',
              state: 'Rajasthan',
              pin: '302001',
            },
          },
          emergency: {
            name: 'Guardian',
            phone: '+91-1234567890',
          },
        },
      };

      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            metadata: { old: { simple: true }, new: deepObject },
          }}
        />,
      );

      // Old value rendered as JSON
      expect(screen.getByText(/simple/)).toBeDefined();
      // Deep new value rendered with nested keys
      expect(screen.getByText(/MG Road/)).toBeDefined();
      expect(screen.getByText(/Jaipur/)).toBeDefined();
      expect(screen.getByText(/302001/)).toBeDefined();
      expect(screen.getByText(/Guardian/)).toBeDefined();
    });

    it('renders nested object diff in UPDATE mode with arrow', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            settings: {
              old: { theme: 'light', notifications: { email: true, sms: false } },
              new: { theme: 'dark', notifications: { email: true, sms: true } },
            },
          }}
        />,
      );

      expect(screen.getByText(/light/)).toBeDefined();
      expect(screen.getByText(/dark/)).toBeDefined();
      expect(screen.getByText('→')).toBeDefined();
    });

    it('renders array of objects as JSON', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            abilities: {
              old: null,
              new: [
                { action: 'read', subject: 'Student' },
                { action: 'manage', subject: 'Attendance' },
              ],
            },
          }}
        />,
      );

      // Array of objects falls through to JSON.stringify via formatValue
      expect(screen.getByText(/read/)).toBeDefined();
      expect(screen.getByText(/Attendance/)).toBeDefined();
    });

    it('handles nested null values in objects', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            config: {
              old: { key: 'value', nested: null },
              new: { key: 'updated', nested: { enabled: true } },
            },
          }}
        />,
      );

      expect(screen.getByText(/updated/)).toBeDefined();
      expect(screen.getByText(/enabled/)).toBeDefined();
    });

    it('renders i18n JSONB field changes', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            name: {
              old: { en: 'Science', hi: 'विज्ञान' },
              new: { en: 'Advanced Science', hi: 'उन्नत विज्ञान' },
            },
          }}
        />,
      );

      // Both old and new contain "Science", so use getAllByText
      const scienceMatches = screen.getAllByText(/Science/);
      expect(scienceMatches.length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/विज्ञान/).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Large / stress payloads ───────────────────────────

  describe('large payloads', () => {
    it('renders many fields without crashing', () => {
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (let i = 0; i < 50; i++) {
        changes[`field_${i}`] = { old: `old_${i}`, new: `new_${i}` };
      }

      render(<AuditDiffRenderer actionType="UPDATE" changes={changes} />);

      expect(screen.getByText('field_0')).toBeDefined();
      expect(screen.getByText('field_49')).toBeDefined();
      expect(screen.getAllByText('→').length).toBe(50);
    });

    it('renders very long string values without error', () => {
      const longString = 'A'.repeat(5000);
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{ description: { old: null, new: longString } }}
        />,
      );

      expect(screen.getByText(longString)).toBeDefined();
    });

    it('renders DELETE with many fields, collapsed by default', () => {
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (let i = 0; i < 30; i++) {
        changes[`field_${i}`] = { old: `deleted_${i}`, new: null };
      }

      render(<AuditDiffRenderer actionType="DELETE" changes={changes} />);

      expect(screen.getByText('30 fields deleted')).toBeDefined();
      expect(screen.queryByText('deleted_0')).toBeNull();
    });
  });

  // ── Custom labels (i18n) ──────────────────────────────

  describe('custom labels', () => {
    it('uses custom noChanges label', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={null}
          labels={{ noChanges: 'कोई बदलाव नहीं' }}
        />,
      );

      expect(screen.getByText('कोई बदलाव नहीं')).toBeDefined();
    });

    it('uses custom fieldsDeleted label function', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{
            a: { old: 'x', new: null },
            b: { old: 'y', new: null },
          }}
          labels={{ fieldsDeleted: (n) => `${n} फ़ील्ड हटाए गए` }}
        />,
      );

      expect(screen.getByText('2 फ़ील्ड हटाए गए')).toBeDefined();
    });

    it('uses custom deletedSnapshot label', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{ name: { old: 'Test', new: null } }}
          labels={{ deletedSnapshot: 'हटाई गई इकाई का स्नैपशॉट' }}
        />,
      );

      // Expand to see the header
      fireEvent.click(screen.getByText('1 field deleted'));
      expect(screen.getByText('हटाई गई इकाई का स्नैपशॉट')).toBeDefined();
    });
  });

  // ── Unknown action types ──────────────────────────────

  describe('unknown action types', () => {
    it('renders RESTORE with old and new columns but no arrow', () => {
      const { container } = render(
        <AuditDiffRenderer
          actionType="RESTORE"
          changes={{ status: { old: 'DELETED', new: 'ACTIVE' } }}
        />,
      );

      expect(screen.getByText('DELETED')).toBeDefined();
      expect(screen.getByText('ACTIVE')).toBeDefined();
      // 3 cells: field + old + new (arrow only for UPDATE)
      const cells = container.querySelectorAll('tbody tr td');
      expect(cells.length).toBe(3);
    });

    it('renders ASSIGN with old and new columns but no arrow', () => {
      const { container } = render(
        <AuditDiffRenderer
          actionType="ASSIGN"
          changes={{ roleId: { old: null, new: 'role-uuid-123' } }}
        />,
      );

      expect(screen.getByText('role-uuid-123')).toBeDefined();
      // 3 cells: field + old (em-dash) + new (arrow only for UPDATE)
      const cells = container.querySelectorAll('tbody tr td');
      expect(cells.length).toBe(3);
    });

    it('handles completely unknown action type without crashing', () => {
      render(
        <AuditDiffRenderer
          actionType="CUSTOM_ACTION"
          changes={{ field: { old: 'a', new: 'b' } }}
        />,
      );

      expect(screen.getByText('a')).toBeDefined();
      expect(screen.getByText('b')).toBeDefined();
    });
  });

  // ── Table structure / accessibility ───────────────────

  describe('table structure', () => {
    it('renders a table element for non-empty changes', () => {
      const { container } = render(
        <AuditDiffRenderer actionType="UPDATE" changes={{ name: { old: 'A', new: 'B' } }} />,
      );

      const table = container.querySelector('table');
      expect(table).not.toBeNull();
    });

    it('has sr-only thead for accessibility', () => {
      const { container } = render(
        <AuditDiffRenderer actionType="UPDATE" changes={{ name: { old: 'A', new: 'B' } }} />,
      );

      const thead = container.querySelector('thead');
      expect(thead).not.toBeNull();
      expect(thead?.className).toContain('sr-only');
    });

    it('renders correct column count for UPDATE (field + old + arrow + new)', () => {
      const { container } = render(
        <AuditDiffRenderer actionType="UPDATE" changes={{ name: { old: 'A', new: 'B' } }} />,
      );

      const cells = container.querySelectorAll('tbody tr td');
      // field + old + arrow + new = 4 cells
      expect(cells.length).toBe(4);
    });

    it('renders correct column count for CREATE (field + new)', () => {
      const { container } = render(
        <AuditDiffRenderer actionType="CREATE" changes={{ name: { old: null, new: 'New' } }} />,
      );

      const cells = container.querySelectorAll('tbody tr td');
      // field + new = 2 cells
      expect(cells.length).toBe(2);
    });

    it('renders correct column count for DELETE expanded (field + old)', () => {
      render(
        <AuditDiffRenderer actionType="DELETE" changes={{ name: { old: 'Deleted', new: null } }} />,
      );

      fireEvent.click(screen.getByText('1 field deleted'));

      const table = document.querySelector('table');
      const cells = table?.querySelectorAll('tbody tr td');
      // field + old = 2 cells
      expect(cells?.length).toBe(2);
    });
  });

  // ── Billing-specific real-world payloads ──────────────

  describe('real-world audit payloads', () => {
    it('renders subscription plan update with feature limits JSONB', () => {
      render(
        <AuditDiffRenderer
          actionType="UPDATE"
          changes={{
            name: {
              old: { en: 'Basic Plan', hi: 'बेसिक प्लान' },
              new: { en: 'Starter Plan', hi: 'स्टार्टर प्लान' },
            },
            amount: { old: 99900, new: 149900 },
            featureLimits: {
              old: { maxStudents: 100, maxTeachers: 10, smsEnabled: false },
              new: { maxStudents: 250, maxTeachers: 25, smsEnabled: true, whatsappEnabled: true },
            },
          }}
        />,
      );

      expect(screen.getByText('name')).toBeDefined();
      expect(screen.getByText('amount')).toBeDefined();
      expect(screen.getByText('featureLimits')).toBeDefined();
      expect(screen.getByText('99900')).toBeDefined();
      expect(screen.getByText('149900')).toBeDefined();
      // maxStudents appears in both old and new JSON
      expect(screen.getAllByText(/maxStudents/).length).toBeGreaterThanOrEqual(2);
      // whatsappEnabled only in new value
      expect(screen.getByText(/whatsappEnabled/)).toBeDefined();
    });

    it('renders institute creation with nested address and contact', () => {
      render(
        <AuditDiffRenderer
          actionType="CREATE"
          changes={{
            name: { old: null, new: { en: 'Delhi Public School', hi: 'दिल्ली पब्लिक स्कूल' } },
            slug: { old: null, new: 'delhi-public-school' },
            type: { old: null, new: 'SCHOOL' },
            address: {
              old: null,
              new: {
                line1: '23 Sector 4',
                city: 'Gurugram',
                state: 'Haryana',
                pinCode: '122001',
                country: 'IN',
              },
            },
            contact: {
              old: null,
              new: {
                email: 'admin@dps.edu.in',
                phone: '+919876543210',
                website: 'https://dps.edu.in',
              },
            },
          }}
        />,
      );

      expect(screen.getByText(/Delhi Public School/)).toBeDefined();
      expect(screen.getByText(/delhi-public-school/)).toBeDefined();
      expect(screen.getByText(/Gurugram/)).toBeDefined();
      expect(screen.getByText(/122001/)).toBeDefined();
      expect(screen.getByText(/dps.edu.in/)).toBeDefined();
      // No arrows for CREATE
      expect(screen.queryByText('→')).toBeNull();
    });

    it('renders soft-delete snapshot with all entity fields', () => {
      render(
        <AuditDiffRenderer
          actionType="DELETE"
          changes={{
            id: { old: 'uuid-123', new: null },
            name: { old: 'Deleted Subject', new: null },
            shortName: { old: 'DS', new: null },
            type: { old: 'ACADEMIC', new: null },
            isMandatory: { old: true, new: null },
            theoryMarks: { old: 80, new: null },
            practicalMarks: { old: 20, new: null },
          }}
        />,
      );

      // Collapsed with count
      expect(screen.getByText('7 fields deleted')).toBeDefined();

      // Expand
      fireEvent.click(screen.getByText('7 fields deleted'));

      expect(screen.getByText('uuid-123')).toBeDefined();
      expect(screen.getByText('Deleted Subject')).toBeDefined();
      expect(screen.getByText('DS')).toBeDefined();
      expect(screen.getByText('ACADEMIC')).toBeDefined();
      expect(screen.getByText('true')).toBeDefined();
      expect(screen.getByText('80')).toBeDefined();
      expect(screen.getByText('20')).toBeDefined();
    });
  });
});
