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
  CircularProgress,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Stack,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AuthGuard from "@/components/AuthGuard";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import { isAdmin, isOrgAdmin } from "@/utils/auth";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsers } from "@/api/user";
import { fetchOrganizations } from "@/api/organization";
import { FetchUsersParams } from "@/api/user";

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const ROLE_DISPLAY: Record<string, string> = {
  admin_user: "Admin",
  org_admin: "Org Admin",
  general_user: "User",
};

export default function UserListPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "created_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [orgFilter, setOrgFilter] = useState<string | "">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const isGeneralAdmin = isAdmin(role);

  const params: FetchUsersParams = {
    page: page + 1,
    page_size: rowsPerPage,
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    ...(isGeneralAdmin && orgFilter !== ""
      ? { organization_uuid: orgFilter }
      : {}),
    ...(activeFilter !== "" ? { is_active: activeFilter === "true" } : {}),
  };

  const {
    data: usersData,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["users", params],
    queryFn: () => fetchUsers(params),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: isGeneralAdmin,
  });

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
    <AuthGuard roleValidators={[isAdmin, isOrgAdmin]}>
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
            Users
          </Typography>
          <ColorBgIconButton
            tooltip="Refresh"
            size="small"
            onClick={() => {
              queryClient.invalidateQueries({
                queryKey: ["users"],
              });
            }}
            color="primary"
            disabled={isLoading || isRefetching}
          >
            <RefreshIcon fontSize="small" />
          </ColorBgIconButton>
        </Box>

        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ mb: 3, flexWrap: "wrap", alignItems: "center" }}
        >
          <TextField
            label="Search by name, email, or organization"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            sx={{ minWidth: 300 }}
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
                setSortBy(e.target.value as "name" | "created_at");
                setPage(0);
              }}
            >
              <MenuItem value="created_at">Created Date</MenuItem>
              <MenuItem value="name">Name</MenuItem>
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
            <InputLabel>Status</InputLabel>
            <Select
              value={activeFilter}
              label="Status"
              onChange={(e) => {
                setActiveFilter(
                  e.target.value as "" | "true" | "false",
                );
                setPage(0);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Blocked</MenuItem>
            </Select>
          </FormControl>

          {isGeneralAdmin && (
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
          )}
        </Stack>

        {isLoading ? (
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
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersData?.items.map((user) => (
                    <TableRow
                      key={user.uuid}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/admin/users/${user.uuid}`)}
                    >
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={ROLE_DISPLAY[user.role] || user.role}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{user.organization_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? "Active" : "Blocked"}
                          color={user.is_active ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <ColorBgIconButton tooltip="View details" size="small">
                          <VisibilityIcon fontSize="small" />
                        </ColorBgIconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {usersData?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={usersData?.total ?? 0}
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
      </Box>
    </AuthGuard>
  );
}