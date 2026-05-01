import type {
  AdmissionNumberConfigModel,
  InstituteAddressObject,
  InstituteAffiliationModel,
  InstituteBrandingModel,
  InstituteConfigModel,
  InstituteContactObject,
  InstituteEmailObject,
  InstituteIdentifierModel,
  InstituteModel,
  InstitutePhoneObject,
  SectionStrengthNormsModel,
  ShiftConfigModel,
  TermConfigModel,
} from '@roviq/graphql/generated';

export type InstitutePhone = InstitutePhoneObject;
export type InstituteEmail = InstituteEmailObject;
export type InstituteContact = InstituteContactObject;
export type InstituteAddress = InstituteAddressObject;
export type InstituteBranding = InstituteBrandingModel;
export type ShiftConfig = ShiftConfigModel;
export type TermConfig = TermConfigModel;
export type SectionStrengthNorms = SectionStrengthNormsModel;
export type AdmissionNumberConfig = AdmissionNumberConfigModel;
export type InstituteConfig = InstituteConfigModel;
export type InstituteIdentifier = InstituteIdentifierModel;
export type InstituteAffiliation = InstituteAffiliationModel;

export interface MyInstituteData {
  myInstitute: InstituteModel;
}

export interface UpdateInstituteInfoData {
  updateInstituteInfo: InstituteModel;
}

export interface UpdateInstituteBrandingData {
  updateInstituteBranding: InstituteModel;
}

export interface UpdateInstituteConfigData {
  updateInstituteConfig: InstituteModel;
}

export interface InstituteBrandingUpdatedData {
  instituteBrandingUpdated: InstituteModel;
}

export interface InstituteConfigUpdatedData {
  instituteConfigUpdated: InstituteModel;
}
