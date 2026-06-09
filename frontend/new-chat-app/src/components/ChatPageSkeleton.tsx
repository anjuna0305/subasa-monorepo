import { Box, Skeleton } from "@mui/material";

export default function ChatPageSkeleton() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        flexGrow: 1,
        height: "100%",
        width: "100%",
        px: 2,
        mx: "auto",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          paddingBottom: 3,
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          px: 2,
        }}
      >
        <Skeleton variant="text" width="60%" height={48} />
        <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box
        sx={{
          width: "100%",
          maxWidth: "900px",
          px: 2,
        }}
      >
        <Skeleton
          variant="rounded"
          width="100%"
          height={80}
          sx={{ borderRadius: 3, mb: 2 }}
        />
      </Box>
    </Box>
  );
}
