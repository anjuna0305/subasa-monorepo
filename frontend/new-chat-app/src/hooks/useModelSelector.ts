import { Model } from "@/types/model";
import { useState } from "react";

export function useModelSelector(){
  const [model, setModel] = useState<Model | null>(null);
  return { model, setModel };
}