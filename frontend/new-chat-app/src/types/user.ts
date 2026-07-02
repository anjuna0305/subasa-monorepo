export type User = {
  uuid: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  is_active: boolean;
  organization_uuid: string | null;
  organization_name: string;
  avatar_url: string | null;
};

export type UsersResponse = {
  items: User[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
