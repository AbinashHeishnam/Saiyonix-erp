import { resolvePublicUrl } from "../services/api/client";

type Props = {
  fileUrl: string | null | undefined;
  token?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export default function SecureImage({
  fileUrl,
  token,
  alt,
  className,
  fallbackClassName,
}: Props) {
  if (!fileUrl) {
    return <div className={fallbackClassName ?? "bg-gray-200 animate-pulse w-full h-full"} />;
  }

  const src = resolvePublicUrl(fileUrl, token ?? undefined);
  return <img src={src} alt={alt} className={className} />;
}
