import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ColorBgButton from "@/components/ColorBgButton";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import AdminGuard from "@/components/AdminGuard";
import { Organization } from "@/types/organizations";
import { useAlert } from "@/hooks/useAlert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOrganizations, createOrganization } from "@/api/organization";

type FormErrors = {
  name?: string;
};

const INITIAL_FORM = {
  name: "",
};

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const { addAlert } = useAlert();

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: (data: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      addAlert("success", "Organization created successfully");
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      setErrors({});
      navigate(`organizations/${data.uuid}`);
    },
  });

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.name.trim()) {
      errs.name = "Name is required";
    }
    return errs;
  }

  function handleSubmit() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    createMutation.mutate(form.name.trim());
  }

  function handleCloseDialog() {
    if (createMutation.isPending) return;
    setDialogOpen(false);
    setForm(INITIAL_FORM);
    setErrors({});
  }

  return (
    <AdminGuard>
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Organizations
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <ColorBgIconButton
              tooltip="Refresh"
              size="small"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["organizations"],
                })
              }
              color="primary"
            >
              <RefreshIcon fontSize="small" />
            </ColorBgIconButton>
            <ColorBgButton
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Add new organization
            </ColorBgButton>
          </Box>
        </Box>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Activation state</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow
                    key={org.uuid}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/admin/organizations/${org.uuid}`)}
                  >
                    <TableCell>{org.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={org.is_active ? "Activated" : "Deactivated"}
                        color={org.is_active ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <ColorBgIconButton tooltip="View details" size="small">
                        <VisibilityIcon fontSize="small" />
                      </ColorBgIconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add new Organization</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Organization Name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                error={!!errors.name}
                helperText={errors.name}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <ColorBgButton
              variant="outlined"
              onClick={handleCloseDialog}
              disabled={createMutation.isPending}
            >
              Cancel
            </ColorBgButton>
            <ColorBgButton
              variant="contained"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </ColorBgButton>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminGuard>
  );
}
