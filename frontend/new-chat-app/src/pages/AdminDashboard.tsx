import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useQuery } from "@tanstack/react-query";

import ColorBgIconButton from "@/components/ColorBgIconButton";
import { fetchUsageSummary } from "@/api/usage";
import { UsageSummary, UsageSummaryRow } from "@/types/usage";

const numberFormat = new Intl.NumberFormat();

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 180 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Share of the allocation consumed, or null when the key has no limit set. */
function usedFraction(row: UsageSummaryRow): number | null {
  if (!row.usage_limit || row.usage_limit <= 0) return null;
  return Math.min(1, row.total_tokens_used / row.usage_limit);
}

export default function AdminDashboardPage() {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<UsageSummary>({
    queryKey: ["usage-summary"],
    queryFn: fetchUsageSummary,
  });

  const rows = data?.items ?? [];
  const activeKeys = new Set(rows.map((row) => row.api_key_uuid)).size;
  const errorCount = rows.reduce((sum, row) => sum + row.error_count, 0);

  return (
    <Box sx={{ p: 3, width: "100%" }}>
      <Stack
        direction="row"
        sx={{ mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="h5">Usage</Typography>
        <ColorBgIconButton
          tooltip="Refresh"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshIcon />
        </ColorBgIconButton>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load usage data.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <StatCard
          label="Tokens used"
          value={numberFormat.format(data?.total_tokens_used ?? 0)}
        />
        <StatCard
          label="Requests"
          value={numberFormat.format(data?.total_requests ?? 0)}
        />
        <StatCard label="Active API keys" value={numberFormat.format(activeKeys)} />
        <StatCard label="Failed requests" value={numberFormat.format(errorCount)} />
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No usage recorded yet. Requests through the metered{" "}
            <code>/api/&#123;service_key&#125;</code> proxy appear here.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>API key</TableCell>
                <TableCell>Service</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell align="right">Requests</TableCell>
                <TableCell align="right">Errors</TableCell>
                <TableCell>Allocation</TableCell>
                <TableCell>Last request</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const fraction = usedFraction(row);
                return (
                  <TableRow key={`${row.api_key_uuid}-${row.service_uuid}`} hover>
                    <TableCell>
                      <Tooltip title={row.user_email}>
                        <span>{row.user_name}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{row.organization_name ?? "—"}</TableCell>
                    <TableCell>{row.api_key_label ?? row.api_key_uuid.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.service_key} />
                    </TableCell>
                    <TableCell align="right">
                      {numberFormat.format(row.total_tokens_used)}
                    </TableCell>
                    <TableCell align="right">
                      {numberFormat.format(row.request_count)}
                    </TableCell>
                    <TableCell align="right">
                      {row.error_count > 0 ? (
                        <Typography color="error" variant="body2">
                          {numberFormat.format(row.error_count)}
                        </Typography>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      {fraction === null ? (
                        <Typography variant="body2" color="text.secondary">
                          unlimited
                        </Typography>
                      ) : (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={fraction * 100}
                            color={fraction >= 1 ? "error" : "primary"}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {numberFormat.format(row.total_tokens_used)} /{" "}
                            {numberFormat.format(row.usage_limit ?? 0)}
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell>{formatTimestamp(row.last_request_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
