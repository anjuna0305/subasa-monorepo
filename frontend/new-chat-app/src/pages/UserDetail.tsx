import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Stack,
  Autocomplete,
  TextField,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ColorBgButton from "@/components/ColorBgButton";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import AuthGuard from "@/components/AuthGuard";
import { isAdmin, isOrgAdmin } from "@/utils/auth";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@/types/user";
import { Organization } from "@/types/organizations";
import { useAlert } from "@/hooks/useAlert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUserById,
  changeUserOrganization,
  blockUser,
  unblockUser,
} from "@/api/user";
import { fetchOrganizations } from "@/api/organization";

const ROLE_DISPLAY: Record<string, string> = {
  admin_user: "Admin",
  org_admin: "Org Admin",
  general_user: "User",
};

export default function UserDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userId = String(id);
  const { addAlert } = useAlert();
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const isGeneralAdmin = isAdmin(role);

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["user", userId],
    queryFn: () => fetchUserById(userId),
    enabled: !!userId,
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: isGeneralAdmin,
  });

  const changeOrgMutation = useMutation({
    mutationFn: changeUserOrganization,
    onSuccess: (data: User) => {
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      addAlert("success", `Organization changed to ${data.organization_name}`);
      setSelectedOrg(null);
    },
  });

  const blockMutation = useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      addAlert("success", "User blocked");
    },
  });

  const unblockMutation = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      addAlert("success", "User unblocked");
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>User not found.</Typography>
      </Box>
    );
  }

  return (
    <AuthGuard roleValidators={[isAdmin, isOrgAdmin]}>
      <Box sx={{ p: 3, maxWidth: "800px", mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <ColorBgIconButton
            tooltip="Back to list"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowBackIcon />
          </ColorBgIconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, ml: 1 }}>
            User Details
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="h6">{user.name}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography>{user.email}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Role
                </Typography>
                <Box>
                  <Chip
                    label={ROLE_DISPLAY[user.role] || user.role}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Organization
                </Typography>
                <Typography>{user.organization_name}</Typography>
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
                  label={user.is_active ? "Active" : "Blocked"}
                  color={user.is_active ? "success" : "error"}
                  size="small"
                />
                {user.is_active ? (
                  <ColorBgButton
                    size="small"
                    onClick={() => blockMutation.mutate(userId)}
                    disabled={blockMutation.isPending}
                    variant="contained"
                    color="warning"
                    sx={{ ml: 1 }}
                  >
                    {blockMutation.isPending ? "Blocking..." : "Block"}
                  </ColorBgButton>
                ) : (
                  <ColorBgButton
                    size="small"
                    onClick={() => unblockMutation.mutate(userId)}
                    disabled={unblockMutation.isPending}
                    variant="contained"
                    color="success"
                    sx={{ ml: 1 }}
                  >
                    {unblockMutation.isPending ? "Unblocking..." : "Unblock"}
                  </ColorBgButton>
                )}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography>
                  {new Date(user.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {isGeneralAdmin && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Change Organization
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Autocomplete
                  id="organization-select"
                  options={organizations}
                  autoHighlight
                  value={selectedOrg}
                  onChange={(_event, selected: Organization | null) => {
                    setSelectedOrg(selected);
                  }}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) =>
                    option.uuid === value.uuid
                  }
                  sx={{ minWidth: 300 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select organization" />
                  )}
                />
                <ColorBgButton
                  variant="contained"
                  onClick={() => {
                    if (selectedOrg) {
                      changeOrgMutation.mutate({
                        userId,
                        organizationUuid: selectedOrg.uuid,
                      });
                    }
                  }}
                  disabled={!selectedOrg || changeOrgMutation.isPending}
                >
                  {changeOrgMutation.isPending ? "Changing..." : "Change"}
                </ColorBgButton>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Box>
    </AuthGuard>
  );
}
