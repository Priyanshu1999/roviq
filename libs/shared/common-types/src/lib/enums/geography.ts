/**
 * Indian States and Union Territories — single source of truth.
 *
 * Consumed by api-gateway (registerEnumType + @IsEnum) and web (Select values).
 * Display labels live in apps/web/messages/en/geography.json.
 * Values are UPPER_SNAKE per Roviq convention.
 */
export const INDIAN_STATE_VALUES = [
  // States
  // Andhra Pradesh — state in south India
  'ANDHRA_PRADESH',
  // Arunachal Pradesh — northernmost state bordering China
  'ARUNACHAL_PRADESH',
  // Assam — state in northeast India
  'ASSAM',
  // Bihar — state in eastern India
  'BIHAR',
  // Chhattisgarh — state in central India
  'CHHATTISGARH',
  // Goa — smallest state, on the western coast
  'GOA',
  // Gujarat — state on the western coast
  'GUJARAT',
  // Haryana — state in northern India
  'HARYANA',
  // Himachal Pradesh — mountainous state in northern India
  'HIMACHAL_PRADESH',
  // Jharkhand — state in eastern India
  'JHARKHAND',
  // Karnataka — state in southern India
  'KARNATAKA',
  // Kerala — southernmost state on the western coast
  'KERALA',
  // Madhya Pradesh — largest state by area, in central India
  'MADHYA_PRADESH',
  // Maharashtra — state in western India; home to Mumbai
  'MAHARASHTRA',
  // Manipur — state in northeast India
  'MANIPUR',
  // Meghalaya — state in northeast India
  'MEGHALAYA',
  // Mizoram — state in northeast India bordering Myanmar
  'MIZORAM',
  // Nagaland — state in northeast India bordering Myanmar
  'NAGALAND',
  // Odisha — state in eastern India on the Bay of Bengal
  'ODISHA',
  // Punjab — state in northwest India
  'PUNJAB',
  // Rajasthan — largest state by area in northwest India
  'RAJASTHAN',
  // Sikkim — smallest state, in the eastern Himalayas
  'SIKKIM',
  // Tamil Nadu — state in southern India
  'TAMIL_NADU',
  // Telangana — state in southern India; formed in 2014
  'TELANGANA',
  // Tripura — state in northeast India
  'TRIPURA',
  // Uttar Pradesh — most populous state, in northern India
  'UTTAR_PRADESH',
  // Uttarakhand — mountainous state in northern India
  'UTTARAKHAND',
  // West Bengal — state in eastern India; home to Kolkata
  'WEST_BENGAL',

  // Union Territories
  // Andaman and Nicobar Islands — UT in the Bay of Bengal
  'ANDAMAN_AND_NICOBAR_ISLANDS',
  // Chandigarh — UT; serves as capital of Punjab and Haryana
  'CHANDIGARH',
  // Dadra and Nagar Haveli and Daman and Diu — UT on the western coast
  'DADRA_AND_NAGAR_HAVELI_AND_DAMAN_AND_DIU',
  // Delhi — National Capital Territory
  'DELHI',
  // Jammu and Kashmir — UT; formerly a state
  'JAMMU_AND_KASHMIR',
  // Ladakh — UT; formed in 2019 from Jammu and Kashmir
  'LADAKH',
  // Lakshadweep — UT; island group in the Arabian Sea
  'LAKSHADWEEP',
  // Puducherry — UT on the southeastern coast
  'PUDUCHERRY',
] as const;

export type IndianState = (typeof INDIAN_STATE_VALUES)[number];

export const IndianState = Object.fromEntries(INDIAN_STATE_VALUES.map((v) => [v, v])) as {
  readonly [K in IndianState]: K;
};
