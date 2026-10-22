import { MoodBoardImage } from "@/hooks/use-styles";
import { Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";

const UploadStatus = (image: {
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}) => {
  if (image.error) {
    return <div role="alert" className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs text-white"><AlertCircle className="mr-1 inline h-4 w-4 text-red-400" />{image.error}</div>;
  }
  if (image.uploading) {
    return (
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  if (image.uploaded) {
    return (
      <div className="absolute top-2 right-2">
        <CheckCircle className="w-5 h-5 text-green-400" />
      </div>
    );
  }

  return null;
};

type Props = {
  image: MoodBoardImage;
  removeImage: (id: string) => void;
  xOffset: number;
  yOffset: number;
  rotation: number;
  zIndex: number;
  marginLeft: string;
  marginTop: string;
};

const ImagesBoard = ({
  image,
  removeImage,
  xOffset,
  yOffset,
  rotation,
  zIndex,
  marginLeft,
  marginTop,
}: Props) => {
  const [preview, setPreview] = useState<{src:string;status:'loaded'|'error'} | null>(null);
  const status = preview?.src === image.preview ? preview.status : 'loading';
  return (
    <div
      key={`board-${image.id}`}
      className="absolute group"
      style={{
        transform: `translate(${xOffset}px, ${yOffset}px) rotate(${rotation}deg)`,
        left: "50%",
        top: "50%",
        zIndex: zIndex,
        marginLeft: marginLeft,
        marginTop: marginTop,
      }}
    >
      <div
        className="relative w-40 h-40 rounded-2xl overflow-hidden bg-white shadow-xl border border-border/20
hover:scale-105 transition-all duration-200"
      >
        <Image
          src={image.preview}
          alt={image.file?.name || "Mood board image"}
          fill
          sizes="160px"
          // The optimizer's internal fetch has no session cookie. Read the
          // authenticated upload URL directly in the user's browser instead.
          unoptimized
          onLoad={() => setPreview({src:image.preview,status:'loaded'})}
          onError={() => setPreview({src:image.preview,status:'error'})}
          className="object-cover"
        />
        <UploadStatus
          uploading={image.uploading || (!image.error && status === 'loading')}
          uploaded={image.uploaded && status === 'loaded'}
          error={image.error || (status === 'error' ? 'Image preview could not load. Check your connection or sign in again, then reload.' : undefined)}
        />
        <button
          onClick={() => removeImage(image.id)}
          className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center
  justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default ImagesBoard;
