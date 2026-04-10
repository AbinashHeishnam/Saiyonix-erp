import React from "react";

import { downloadSecureFile } from "../utils/secureFile";

type Props = {
  fileUrl: string | null | undefined;
  fileName?: string;
  className?: string;
  children: React.ReactNode;
};

export default function SecureLink({
  fileUrl,
  fileName,
  className,
  children,
}: Props) {
  return (
    <a
      href="#"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        if (!fileUrl) return;
        downloadSecureFile(fileUrl, fileName);
      }}
    >
      {children}
    </a>
  );
}
