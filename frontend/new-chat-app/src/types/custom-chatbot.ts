export type CustomChatbot = {
  uuid: string;
  chatbot_name: string;
  file_path: string;
  organization_uuid: string | null;
  description: string;
  hero_image: string;
  url_path: string;
  retrieval_key: string;
  is_publish: boolean;
  is_public: boolean;
  created_at: string;
};

export type ChatbotsResponse = {
  items: CustomChatbot[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
