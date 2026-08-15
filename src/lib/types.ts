export type Coordinate = { latitude: number; longitude: number };

export type DriverMeta = {
  profile_complete: boolean;
  status: string;
  average_rating: number;
  completed_rides: number;
};

export type Me = {
  user: {
    id: string;
    role: 'DRIVER';
    first_name: string;
    last_name: string;
    account_status: string;
    identity_verified: boolean;
    eligibility_verified: boolean;
  };
  driver: DriverMeta;
};

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: string;
  pickup: Coordinate;
  dropoff: Coordinate;
  pickup_address: string;
  dropoff_address: string;
  estimated_distance_m: number;
  estimated_duration_s: number;
  estimated_fare_minor: number;
  currency: string;
  route_coordinates?: Coordinate[] | null;
  driver?: any;
};

export type Offer = {
  offer_id: string;
  ride_id: string;
  driver_id: string;
  expires_at: string;
  expires_in_seconds: number;
  pickup: Coordinate;
  dropoff: Coordinate;
  pickup_address: string;
  destination_neighborhood: string;
  pickup_distance_m: number;
  estimated_earnings_minor: number;
  currency: string;
};

export type TabId = 'home' | 'trips' | 'earnings' | 'inbox' | 'account';
export type AccountPanel =
  | 'menu'
  | 'profile'
  | 'vehicle'
  | 'documents'
  | 'safety'
  | 'support'
  | 'settings'
  | 'performance'
  | 'incentives'
  | 'disputes'
  | 'status';

export type DocStatus = 'done' | 'pending' | 'missing' | 'expired';

export type OnboardingDraft = {
  pin: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  profile_photo_note: string;
  license_front_note: string;
  id_document_note: string;
  vehicle_reg_note: string;
  insurance_note: string;
  inspection_note: string;
  vehicle_photos_note: string;
  bank_provider: string;
  bank_account: string;
  tax_id: string;
  agreed_terms: boolean;
  training_done: boolean;
  license_number: string;
  license_country: string;
  license_expiry: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  vehicle_type: string;
  plate_number: string;
  plate_country: string;
};

export const defaultOnboarding = (): OnboardingDraft => ({
  pin: '',
  address: 'Bole, Addis Ababa',
  emergency_name: '',
  emergency_phone: '+2519',
  profile_photo_note: '',
  license_front_note: '',
  id_document_note: '',
  vehicle_reg_note: '',
  insurance_note: '',
  inspection_note: '',
  vehicle_photos_note: '',
  bank_provider: 'Telebirr',
  bank_account: '',
  tax_id: '',
  agreed_terms: false,
  training_done: false,
  license_number: 'ET-DL-100200',
  license_country: 'ET',
  license_expiry: '2028-12-31',
  vehicle_make: 'Toyota',
  vehicle_model: 'Corolla',
  vehicle_year: '2021',
  vehicle_color: 'Silver',
  vehicle_type: 'STANDARD',
  plate_number: 'AA-3-12345',
  plate_country: 'ET'
});
