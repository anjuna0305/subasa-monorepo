import { Box, Skeleton } from "@mui/material";

export default function GenericPageSkeleton() {
  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Skeleton variant="text" width="50%" height={40} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="70%" height={24} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" width="100%" height={200} />
    </Box>
  );
}
