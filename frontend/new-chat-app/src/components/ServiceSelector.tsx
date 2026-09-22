import { Box } from "@mui/material";
import { MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useNavigate, useLocation } from "react-router";
import { useState } from "react";
import { Service } from "@/types/service";

interface Props {
  services: Service[];
}

export default function ServiceSelector({ services }: Props) {
  const location = useLocation();
  const [service, setModel] = useState<Service>(
    services.find((s) => s.path === location.pathname) || services[0],
  );
  const navigate = useNavigate();

  const handleServiceChange = (event: SelectChangeEvent<string>) => {
    const selectedModel = services.find(
      (s) => s.serviceCodeName == event.target.value,
    );
    if (!selectedModel) return;

    setModel(selectedModel);
    if (selectedModel) {
    }
    navigate(selectedModel.path);
  };

  return (
    <Box
      sx={{
        width: "100%",
        px: 2,
      }}
    >
      <Select
        variant="standard"
        disableUnderline
        labelId="selected-service-label"
        id="selected-service-id"
        value={service.serviceCodeName}
        onChange={handleServiceChange}
      >
        {services.map((s) => (
          <MenuItem key={s.uuid} value={s.serviceCodeName}>
            {s.serviceDisplayName}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}