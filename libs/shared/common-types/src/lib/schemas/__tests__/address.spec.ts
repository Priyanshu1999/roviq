import { describe, expect, it } from 'vitest';
import { addressSchema, createAddressSchema, optionalAddressSchema } from '../address';

describe('addressSchema', () => {
  const validAddress = {
    line1: '42, MG Road',
    line2: 'Near Axis Bank',
    line3: '',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    postal_code: '302001',
    country: 'IN',
    coordinates: { lat: 26.9124, lng: 75.7873 },
  };

  it('parses a fully populated valid address', () => {
    const result = addressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.line1).toBe('42, MG Road');
      expect(result.data.coordinates?.lat).toBe(26.9124);
      expect(result.data.coordinates?.lng).toBe(75.7873);
    }
  });

  it('parses a valid address without coordinates', () => {
    const { coordinates, ...noCoords } = validAddress;
    void coordinates;
    const result = addressSchema.safeParse(noCoords);
    expect(result.success).toBe(true);
  });

  it('defaults line2/line3/country when omitted', () => {
    const result = addressSchema.safeParse({
      line1: '1 Main St',
      city: 'Jaipur',
      district: 'Jaipur',
      state: 'Rajasthan',
      postal_code: '302001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.line2).toBe('');
      expect(result.data.line3).toBe('');
      expect(result.data.country).toBe('IN');
    }
  });

  describe('NaN lat/lng regression guard (RHF valueAsNumber empty input)', () => {
    it('treats NaN latitude as undefined (not an error)', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: Number.NaN, lng: Number.NaN },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coordinates?.lat).toBeUndefined();
        expect(result.data.coordinates?.lng).toBeUndefined();
      }
    });

    it('treats one NaN and one valid as partial coordinates', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: 26.9124, lng: Number.NaN },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coordinates?.lat).toBe(26.9124);
        expect(result.data.coordinates?.lng).toBeUndefined();
      }
    });
  });

  describe('required fields', () => {
    it('rejects missing line1', () => {
      const result = addressSchema.safeParse({ ...validAddress, line1: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing city', () => {
      const result = addressSchema.safeParse({ ...validAddress, city: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing district', () => {
      const result = addressSchema.safeParse({ ...validAddress, district: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing state', () => {
      const result = addressSchema.safeParse({ ...validAddress, state: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('pinCode format', () => {
    it('rejects 5-digit PIN', () => {
      const result = addressSchema.safeParse({ ...validAddress, postal_code: '30200' });
      expect(result.success).toBe(false);
    });

    it('rejects PIN with letters', () => {
      const result = addressSchema.safeParse({ ...validAddress, postal_code: '30200A' });
      expect(result.success).toBe(false);
    });

    it('rejects 7-digit PIN', () => {
      const result = addressSchema.safeParse({ ...validAddress, postal_code: '3020011' });
      expect(result.success).toBe(false);
    });

    it('accepts exactly 6 digits', () => {
      const result = addressSchema.safeParse({ ...validAddress, postal_code: '110001' });
      expect(result.success).toBe(true);
    });
  });

  describe('coordinate bounds', () => {
    it('rejects latitude > 90', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: 91, lng: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects latitude < -90', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: -91, lng: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects longitude > 180', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: 0, lng: 181 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects longitude < -180', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: 0, lng: -181 },
      });
      expect(result.success).toBe(false);
    });

    it('accepts boundary values', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        coordinates: { lat: 90, lng: -180 },
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('createAddressSchema (i18n messages)', () => {
  it('uses provided error messages', () => {
    const schema = createAddressSchema({
      line1Required: 'CUSTOM_LINE1',
      postalCodeInvalid: 'CUSTOM_PIN',
    });
    const result = schema.safeParse({
      line1: '',
      city: 'Jaipur',
      district: 'Jaipur',
      state: 'Rajasthan',
      postal_code: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('CUSTOM_LINE1');
      expect(messages).toContain('CUSTOM_PIN');
    }
  });
});

describe('optionalAddressSchema', () => {
  it('accepts a completely empty address', () => {
    const result = optionalAddressSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.line1).toBe('');
      expect(result.data.country).toBe('IN');
      expect(result.data.coordinates).toBeUndefined();
    }
  });

  it('still applies NaN preprocess on optional schema', () => {
    const result = optionalAddressSchema.safeParse({
      coordinates: { lat: Number.NaN, lng: Number.NaN },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coordinates?.lat).toBeUndefined();
      expect(result.data.coordinates?.lng).toBeUndefined();
    }
  });

  it('still enforces coordinate bounds when values provided', () => {
    const result = optionalAddressSchema.safeParse({
      coordinates: { lat: 91, lng: 0 },
    });
    expect(result.success).toBe(false);
  });
});
