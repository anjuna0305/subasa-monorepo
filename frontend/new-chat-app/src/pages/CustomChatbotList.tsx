import { useState, useCallback } from "react";
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
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ColorBgButton from "@/components/ColorBgButton";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import { CustomChatbot } from "@/types/custom-chatbot";
import AdminGuard from "@/components/AdminGuard";
import { Organization } from "@/types/organizations";
import { useAlert } from "@/hooks/useAlert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChatbots, createCustomChatbot } from "@/api/chatbot";
import { FetchChatbotsParams } from "@/api/chatbot";
import { fetchOrganizations } from "@/api/organization";

type FormErrors = {
  chatbot_name?: string;
  description?: string;
  url_path?: string;
};

type FormState = {
  chatbot_name: string;
  description: string;
  url_path: string;
  organization_uuid: string | null;
  is_public: boolean;
};

const INITIAL_FORM: FormState = {
  chatbot_name: "",
  description: "",
  url_path: "",
  organization_uuid: null,
  is_public: true,
};

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function CustomChatbotListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addAlert } = useAlert();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<"chatbot_name" | "created_at">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [publishFilter, setPublishFilter] = useState<
    "" | "true" | "false"
  >("");
  const [publicFilter, setPublicFilter] = useState<
    "" | "true" | "false"
  >("");
  const [orgFilter, setOrgFilter] = useState<string | "">("");

  const params: FetchChatbotsParams = {
    page: page + 1,
    page_size: rowsPerPage,
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    ...(publishFilter !== "" ? { is_publish: publishFilter === "true" } : {}),
    ...(publicFilter !== "" ? { is_public: publicFilter === "true" } : {}),
    ...(orgFilter !== "" ? { organization_uuid: orgFilter } : {}),
  };

  const {
    data: chatbotsData,
    isLoading: loading,
    isRefetching,
  } = useQuery({
    queryKey: ["custom-chatbots", params],
    queryFn: () => fetchChatbots(params),
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: createCustomChatbot,
    onSuccess: (data: CustomChatbot) => {
      queryClient.invalidateQueries({ queryKey: ["custom-chatbots"] });
      addAlert("success", "Chatbot created successfully");
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      setErrors({});
      navigate(`${data.uuid}`);
    },
  });

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.chatbot_name.trim()) {
      errs.chatbot_name = "Name is required";
    }
    if (!form.description.trim()) {
      errs.description = "Description is required";
    }
    if (!form.url_path.trim()) {
      errs.url_path = "URL path is required";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.url_path.trim())) {
      errs.url_path = "Must be a valid slug (e.g. helpdesk-bot)";
    }
    return errs;
  }

  function handleSubmit() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    createMutation.mutate({
      chatbot_name: form.chatbot_name.trim(),
      description: form.description.trim(),
      url_path: form.url_path.trim(),
      organization_uuid: form.organization_uuid,
      is_public: form.is_public,
    });
  }

  function handleCloseDialog() {
    if (createMutation.isPending) return;
    setDialogOpen(false);
    setForm(INITIAL_FORM);
    setErrors({});
  }

  const handleSearchSubmit = useCallback(() => {
    setSearch(searchInput);
    setPage(0);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearchSubmit();
    },
    [handleSearchSubmit],
  );

  const clearSearch = useCallback(() => {
    setSearch("");
    setSearchInput("");
    setPage(0);
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(0);
  }, []);

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
            Custom chat bots
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <ColorBgIconButton
              tooltip="Refresh"
              size="small"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["custom-chatbots"],
                })
              }
              color="primary"
              disabled={loading || isRefetching}
            >
              <RefreshIcon fontSize="small" />
            </ColorBgIconButton>
            <ColorBgButton
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Add new chatbot
            </ColorBgButton>
          </Box>
        </Box>

        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ mb: 3, flexWrap: "wrap", alignItems: "center" }}
        >
          <TextField
            label="Search by name"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            sx={{ minWidth: 260 }}
          />
          <ColorBgIconButton
            tooltip="Search"
            size="small"
            onClick={handleSearchSubmit}
            color="primary"
          >
            <SearchIcon fontSize="small" />
          </ColorBgIconButton>
          {search && (
            <ColorBgIconButton
              tooltip="Clear search"
              size="small"
              onClick={clearSearch}
              color="primary"
            >
              <CloseIcon fontSize="small" />
            </ColorBgIconButton>
          )}

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              label="Sort by"
              onChange={(e) => {
                setSortBy(
                  e.target.value as "chatbot_name" | "created_at",
                );
                setPage(0);
              }}
            >
              <MenuItem value="created_at">Created Date</MenuItem>
              <MenuItem value="chatbot_name">Name</MenuItem>
            </Select>
          </FormControl>

          <IconButton
            size="small"
            onClick={toggleSortOrder}
            title="Toggle sort order"
          >
            {sortOrder === "asc" ? (
              <ArrowUpwardIcon fontSize="small" />
            ) : (
              <ArrowDownwardIcon fontSize="small" />
            )}
          </IconButton>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Published</InputLabel>
            <Select
              value={publishFilter}
              label="Published"
              onChange={(e) => {
                setPublishFilter(
                  e.target.value as "" | "true" | "false",
                );
                setPage(0);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Published</MenuItem>
              <MenuItem value="false">Unpublished</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Visibility</InputLabel>
            <Select
              value={publicFilter}
              label="Visibility"
              onChange={(e) => {
                setPublicFilter(
                  e.target.value as "" | "true" | "false",
                );
                setPage(0);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Public</MenuItem>
              <MenuItem value="false">Private</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Organization</InputLabel>
            <Select
              value={orgFilter}
              label="Organization"
              onChange={(e) => {
                setOrgFilter(e.target.value as string | "");
                setPage(0);
              }}
            >
              <MenuItem value="">All</MenuItem>
              {organizations.map((org) => (
                <MenuItem key={org.uuid} value={org.uuid}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>URL Path</TableCell>
                    <TableCell>Published</TableCell>
                    <TableCell>Visibility</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chatbotsData?.items.map((chatbot) => (
                    <TableRow
                      key={chatbot.uuid}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() =>
                        navigate(`/admin/custom-chatbot/${chatbot.uuid}`)
                      }
                    >
                      <TableCell>{chatbot.chatbot_name}</TableCell>
                      <TableCell>{chatbot.url_path}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            chatbot.is_publish ? "Published" : "Unpublished"
                          }
                          color={chatbot.is_publish ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={chatbot.is_public ? "Public" : "Private"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <ColorBgIconButton tooltip="View details" size="small">
                          <VisibilityIcon fontSize="small" />
                        </ColorBgIconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {chatbotsData?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No chatbots found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={chatbotsData?.total ?? 0}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            />
          </>
        )}

        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add new chatbot</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Chatbot Name"
                value={form.chatbot_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chatbot_name: e.target.value }))
                }
                error={!!errors.chatbot_name}
                helperText={errors.chatbot_name}
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                error={!!errors.description}
                helperText={errors.description}
                fullWidth
                multiline
                rows={3}
              />
              <TextField
                label="URL Path"
                placeholder="e.g. helpdesk-bot"
                value={form.url_path}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url_path: e.target.value }))
                }
                error={!!errors.url_path}
                helperText={errors.url_path}
                fullWidth
              />
              <Autocomplete
                id="organization-select"
                options={organizations}
                autoHighlight
                onChange={(event, selectedOrg: Organization | null) => {
                  setForm((f) => ({
                    ...f,
                    organization_uuid: selectedOrg?.uuid || null,
                  }));
                }}
                getOptionLabel={(option) => option.name}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box
                      key={key}
                      component="li"
                      sx={{ "& > img": { mr: 2, flexShrink: 0 } }}
                      {...optionProps}
                    >
                      {option.name}
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select organization" />
                )}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_public}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        is_public: e.target.checked,
                      }));
                    }}
                  />
                }
                label="Make chatbot available for public"
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