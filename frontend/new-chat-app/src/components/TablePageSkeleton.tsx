import { Box, Skeleton } from "@mui/material";

export default function TablePageSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Skeleton variant="text" width={200} height={36} />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="rounded" width={160} height={36} />
        </Box>
      </Box>

      <Box sx={{ borderRadius: 1 }}>
        <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 1 }} />
        {[...Array(5)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width="100%"
            height={52}
            sx={{ mb: 0.5 }}
          />
        ))}
      </Box>
    </Box>
  );
}
