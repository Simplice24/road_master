import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

// Every field optional — also how a plan is activated/deactivated ({ isActive }). The merged
// result is re-validated as a whole, so switching accessType must null out the other limit.
export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
