export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  organization_uuid: string;
  role: string;
};
