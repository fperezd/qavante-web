export type UserRole =
  | "owner"
  | "admin"
  | "finance_manager"
  | "accountant"
  | "viewer"
  | "external_advisor"
  | "technical_admin";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type SessionData = {
  user: SessionUser;
};
