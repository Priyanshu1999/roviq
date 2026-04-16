import { Field, InputType } from '@nestjs/graphql';
import { IsHexColor, IsOptional, IsString, IsUrl } from 'class-validator';

@InputType({
  description: 'Visual branding fields for the institute portal. All fields are optional.',
})
export class UpdateInstituteBrandingInput {
  @Field({
    nullable: true,
    description: 'MinIO/S3 URL of the institute logo shown in the portal header.',
  })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @Field({ nullable: true, description: 'MinIO/S3 URL of the favicon (16×16 or 32×32 PNG/ICO).' })
  @IsUrl()
  @IsOptional()
  faviconUrl?: string;

  @Field({
    nullable: true,
    description:
      'Primary brand colour in hex format, e.g. "#1677FF". Used for buttons, links, and highlights.',
  })
  @IsString()
  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @Field({
    nullable: true,
    description:
      'Secondary brand colour in hex format, e.g. "#5BC0EB". Used for accents and secondary actions.',
  })
  @IsString()
  @IsHexColor()
  @IsOptional()
  secondaryColor?: string;

  @Field({
    nullable: true,
    description: 'Theme identifier key for switching between pre-built UI theme presets.',
  })
  @IsString()
  @IsOptional()
  themeIdentifier?: string;

  @Field({
    nullable: true,
    description: 'MinIO/S3 URL of a cover/banner image shown on login and dashboard hero sections.',
  })
  @IsUrl()
  @IsOptional()
  coverImageUrl?: string;
}
