export type UserTier = 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';

export type PetProfile = {
  id: string;
  ownerId: string;
  tagId: string;
  name: string;
  species: string;
  breed?: string;
  medicalNotes?: string;
  behaviorNotes?: string;
  publicContactName?: string;
  publicPhone?: string;
  publicEmail?: string;
  lostMode: boolean;
  lastScan?: ScanLocation;
};

export type ScanLocation = {
  latitude: number;
  longitude: number;
  scannedAt: string;
  scannerType: 'owner' | 'linked_user' | 'stranger';
  note?: string;
};
