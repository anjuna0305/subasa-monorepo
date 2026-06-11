import { useNavigate, useParams } from "react-router";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ColorBgButton from "@/components/ColorBgButton";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import AdminGuard from "@/components/AdminGuard";
import { Organization } from "@/types/organizations";
import { useAlert } from "@/hooks/useAlert";
import {useMutation, useQueryClient } from "@tanstack/react-query";
import {
  toggleOrganizationActive,
} from "@/api/organization";
import { useOrganiztion } from "@/hooks/organiztion/useOrganization";

export default function OrganizationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const orgId = String(id);
  const { addAlert } = useAlert();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useOrganiztion(orgId)

  const toggleMutation = useMutation({
    mutationFn: toggleOrganizationActive,
    onSuccess: (data: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      addAlert(
        "success",
        data.is_active ? "Organization activated" : "Organization deactivated",
      );
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!org) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Organization not found.</Typography>
      </Box>
    );
  }

  return (
    <AdminGuard>
      <Box sx={{ p: 3, maxWidth: "800px", mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <ColorBgIconButton
            tooltip="Back to list"
            onClick={() => navigate("/admin/organizations")}
          >
            <ArrowBackIcon />
          </ColorBgIconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, ml: 1 }}>
            Organization Details
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="h6">{org.name}</Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={org?.is_active ? "Active" : "Deactive"}
                  color={org?.is_active ? "success" : "default"}
                  size="small"
                />
                <ColorBgButton
                  size="small"
                  onClick={() =>
                    toggleMutation.mutate({ id: orgId, isActive: org.is_active })
                  }
                  disabled={toggleMutation.isPending}
                  variant="contained"
                  color={org?.is_active ? "warning" : "success"}
                  sx={{ ml: 1 }}
                >
                  {toggleMutation.isPending
                    ? "Updating..."
                    : org?.is_active
                      ? "deactivate"
                      : "activate"}
                </ColorBgButton>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography>
                  {new Date(org.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </AdminGuard>
  );
}