import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { UpdateMyProfileInput } from './dto/update-my-profile.input';
import { MyGuardianProfile, MyProfileUnion, UserProfileData } from './models/profile.model';
import { ProfileService } from './profile.service';

@InstituteScope()
@Resolver()
export class ProfileResolver {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Returns the current user's profile based on their membership type.
   * Student → student data + academics
   * Staff → staff data + qualifications
   * Guardian → guardian data + linked children
   */
  @Query(() => MyProfileUnion, { description: 'Get current user profile based on membership type' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'User')
  async myProfile(@CurrentUser() user: AuthUser) {
    return this.profileService.getMyProfile(user.userId, user.membershipId);
  }

  /**
   * Self-service update: can update phone, address, photo.
   * Cannot change name, DOB, or identity documents — those require admin approval.
   */
  @Mutation(() => UserProfileData, {
    description: 'Update own profile (phone, photo, nationality)',
  })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'User')
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Args('input') input: UpdateMyProfileInput,
  ): Promise<UserProfileData> {
    return this.profileService.updateMyProfile(user.userId, input) as Promise<UserProfileData>;
  }

  /**
   * For guardians: returns all students linked via student_guardian_links.
   * This is the "myChildren" query for the parent dashboard.
   */
  @Query(() => MyGuardianProfile, {
    nullable: true,
    description: 'Guardian-specific: returns linked children (sibling discovery)',
  })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'User')
  async myChildren(@CurrentUser() user: AuthUser) {
    const profile = await this.profileService.getMyProfile(user.userId, user.membershipId);
    if (profile.type !== 'guardian') return null;
    return profile;
  }
}
