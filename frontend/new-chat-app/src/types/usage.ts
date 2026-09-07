export interface UsageSummaryRow {
  api_key_uuid: string;
  api_key_label: string | null;
  user_uuid: string;
  user_name: string;
  user_email: string;
  organization_name: string | null;
  service_uuid: string;
  service_key: string;
  service_name: string;
  total_tokens_used: number;
  request_count: number;
  error_count: number;
  usage_limit: number | null;
  last_request_at: string | null;
}

export interface UsageSummary {
  items: UsageSummaryRow[];
  total_tokens_used: number;
  total_requests: number;
}
