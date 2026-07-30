export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  roleKeys: string[];
  permissionKeys: string[];
  unitScope: {
    all: boolean;
    unitIds: string[];
  };
}
