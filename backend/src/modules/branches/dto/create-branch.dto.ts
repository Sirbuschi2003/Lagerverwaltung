export class CreateBranchDto {
  name!: string;
  externalCode?: string | null;
  address?: string | null;
  active?: boolean;
}
