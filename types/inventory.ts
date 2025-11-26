export type ProductStatus = 'received' | 'released' | 'transferred' | 'awaiting_from_nevis';
export type UploadStatus = 'uploaded' | 'validated' | null;
export type Destination = 'Saint Kitts' | 'Nevis';

export interface Product {
  id: string;
  barcode: string;
  ownerId: string;
  status: ProductStatus;
  uploadStatus?: UploadStatus;
  storageLocation: string;
  destination: Destination;
  dateAdded: string;
  dateUpdated: string;
  dateReleased?: string;
  dateTransferred?: string;
  receivedBy?: string;
  releasedBy?: string;
  transferredBy?: string;
  notes?: string;
  customerName?: string;
  price?: string;
  comment?: string;
}

export type ProductInput = Omit<Product, 'id' | 'ownerId' | 'dateAdded' | 'dateUpdated'>;
