export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roleKeys: string[];
  permissionKeys: string[];
  unitScope: {
    all: boolean;
    unitIds: string[];
  };
}
