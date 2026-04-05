"use client";
import { useEffect } from "react";

interface WatermarkFormProps {
  watermarkText: string;
  onWatermarkChange: (text: string) => void;
  onApplyWatermark: () => void;
}

export default function WatermarkForm({
  watermarkText,
  onWatermarkChange,
  onApplyWatermark,
}: WatermarkFormProps) {
  useEffect(() => {}, []);
  return (
    <div className="flex flex-col w-full gap-2">
      <input
        type="text"
        value={watermarkText}
        onChange={(e) => onWatermarkChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
        placeholder="Entrez le texte du filigrane (ex: usage exclusif site.com)"
      />
      <button
        onClick={onApplyWatermark}
        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
      >
        Appliquer le filigrane
      </button>
    </div>
  );
}
