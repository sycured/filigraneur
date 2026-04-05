"use client";

interface FileUploadProps {
  onFileChange: (file: File) => void;
}

export default function FileUpload({ onFileChange }: FileUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  return (
    <div className=" w-full">
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="border border-gray-300 dark:border-gray-600 rounded p-2 w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      />
    </div>
  );
}
