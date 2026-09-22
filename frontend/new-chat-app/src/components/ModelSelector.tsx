
import { Box } from "@mui/material";
import { MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useEffect, useState } from "react";
import { Model } from "@/types/model";

interface Props {
  model: Model;
  setModel: (modelId: Model) => void;
  modelLoader: () => Promise<Model[]>;
}

export default function ModelSelector({ model, setModel, modelLoader }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [modelLoading, setModelLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadModels = async () => {
      setModelLoading(true);
      const data = await modelLoader();
      setModels(data);

      setModelLoading(false);
    };
    loadModels();
  }, [modelLoader]);

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    const selectedModel = models.find((m) => m.modelCode == event.target.value);
    if (!selectedModel) return;

    setModel(selectedModel);
    if (selectedModel) {
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        px: 2,
      }}
    >
      <Select
        disabled={modelLoading}
        variant="standard"
        disableUnderline
        labelId="selected-service-label"
        id="selected-service-id"
        value={model.modelCode}
        onChange={handleModelChange}
      >
        {models.map((m) => (
          <MenuItem key={m.modelCode + 100} value={m.modelCode}>
            {m.modelName}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
