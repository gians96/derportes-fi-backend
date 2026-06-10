import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class ArrangeFixtureDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  teamOrder: number[];
}
