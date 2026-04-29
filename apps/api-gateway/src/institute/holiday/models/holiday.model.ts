import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { HolidayType } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';

registerEnumType(HolidayType, {
  name: 'HolidayType',
  description:
    'Classification of a holiday — NATIONAL, STATE, RELIGIOUS, INSTITUTE, SUMMER_BREAK, WINTER_BREAK, or OTHER.',
});

@ObjectType({
  description:
    'An institute-published holiday or break. When a session-open date falls inside [startDate, endDate], attendance refuses to create the session.',
})
export class HolidayModel {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar, {
    description: 'Localised holiday name, e.g. { en: "Diwali", hi: "दिवाली" }.',
  })
  name!: I18nContent;

  @Field(() => String, {
    nullable: true,
    description: 'Optional notes — circular reference, history, or context.',
  })
  description!: string | null;

  @Field(() => HolidayType)
  type!: HolidayType;

  @Field(() => String, { description: 'Inclusive start date as ISO YYYY-MM-DD.' })
  startDate!: string;

  @Field(() => String, { description: 'Inclusive end date as ISO YYYY-MM-DD.' })
  endDate!: string;

  @Field(() => [String], {
    description: 'Free-form tags for filtering/theming (e.g. ["gazetted", "restricted"]).',
  })
  tags!: string[];

  @Field(() => Boolean, {
    description:
      'Whether the holiday is visible to non-admin users. `false` means draft/admin-only — still blocks attendance sessions.',
  })
  isPublic!: boolean;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
