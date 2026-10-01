import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderOptionsDto {
  /** Every option id of the question, in the new display order. */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds!: string[];
}
