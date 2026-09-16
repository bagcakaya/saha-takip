import React from 'react';
import { ImageLightboxModal } from './ImageLightboxModal';

export interface LightboxProps {
  photoUrl?: string | null;
  images?: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
  onDelete?: (photoUrl: string, index?: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  photoUrl,
  images,
  initialIndex,
  title,
  onClose,
  onDelete,
}) => {
  return (
    <ImageLightboxModal
      isOpen={Boolean(photoUrl || (images && images.length > 0))}
      imageUrl={photoUrl}
      images={images}
      initialIndex={initialIndex}
      title={title}
      onClose={onClose}
      onDelete={onDelete ? (url, idx) => onDelete(url, idx) : undefined}
    />
  );
};
