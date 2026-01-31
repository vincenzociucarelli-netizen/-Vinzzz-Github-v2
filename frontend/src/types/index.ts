export interface User {
  id: string;
  email: string;
  role: 'admin' | 'coach' | 'parent' | 'athlete';
  full_name: string;
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
  training_days?: string;
  training_time?: string;
  championships?: string;
  calendar_link?: string;
}

export interface Athlete {
  id: string;
  parent_id: string;
  full_name: string;
  date_of_birth: string;
  is_minor: boolean;
  team_id: string;
  qr_code: string;
  registration_date: string;
  trial_end_date: string;
  privacy_accepted: boolean;
  privacy_accepted_date?: string;
  image_consent: boolean;
  status: string;
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
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_date?: string;
  payment_method?: string;
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
