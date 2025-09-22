import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetSnapTokenDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;
}
