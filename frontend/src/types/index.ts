export interface User {
  id: string;
  email: string;
  role: 'admin' | 'viewer' | 'coach' | 'parent' | 'athlete' | 'minor';
  full_name: string;
  status?: string;
  profile_photo?: string;
  athlete_id?: string;
}

export interface TrainingSession {
  day: string;
  timeStart: string;
  timeEnd: string;
  venue: string;
}

export interface MatchDay {
  day: string;
  time: string;
  venue: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_by_admin_id: string;
  created_at: string;
  total_amount: number;
  installment_1_amount: number;
  installment_2_amount: number;
  installment_2_due_date: string;
  installment_3_amount: number;
  installment_3_due_date: string;
  bank_info: string;
  paypal_email: string;
  venue?: string;
  training_schedule?: string;
  training_sessions?: TrainingSession[];
  match_day?: MatchDay;
  championships?: string;
  calendar_link?: string;
}

export interface Athlete {
  id: string;
  parent_id: string;
  // Tesseramento (Admin)
  federal_code?: string;
  is_registered?: boolean;
  // Anagrafica
  full_name: string;
  first_name?: string;
  last_name?: string;
  date_of_birth: string;
  birth_place?: string;
  birth_province?: string;
  is_minor: boolean;
  fiscal_code: string;
  email?: string;
  phone_athlete?: string;
  phone_father?: string;
  phone_mother?: string;
  // Residenza
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  // Genitore detrazione
  tax_payer_name?: string;
  tax_payer_fiscal_code?: string;
  // Squadra e stato
  team_id: string;
  qr_code: string;
  registration_date: string;
  trial_end_date: string;
  trial_start_date?: string;
  trial_document_generated?: boolean;
  is_trial?: boolean;
  privacy_accepted: boolean;
  privacy_accepted_date?: string;
  image_consent: boolean;
  status: string;
  // Fine periodo di prova
  end_trial_requested?: boolean;
  end_trial_requested_date?: string;
  // Cancellazione
  deletion_requested?: boolean;
  deletion_requested_at?: string;
  deletion_requested_by_name?: string;
  // Sconto
  discount_amount?: number;
  discount_note?: string;
}

export interface Certificate {
  id: string;
  athlete_id: string;
  pdf_data: string;
  issue_date: string;
  validity_months: number;
  expiry_date: string;
  uploaded_at: string;
}

export interface Payment {
  id: string;
  athlete_id: string;
  installment_number?: number;
  description?: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_date?: string;
  payment_method?: string;
  is_cash?: boolean;
  notes?: string;
  created_at: string;
}

export interface PaymentSettings {
  id: string;
  season: string;
  installment_1_amount: number;
  installment_2_amount: number;
  installment_2_due_date: string;
  installment_3_amount: number;
  installment_3_due_date: string;
  bank_info: string;
  paypal_email: string;
}

export interface Attendance {
  id: string;
  athlete_id: string;
  coach_id: string;
  check_in_time: string;
  status: string;
  block_reason?: string;
}
