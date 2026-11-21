CREATE DATABASE IF NOT EXISTS afycare_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE afycare_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('patient','admin') NOT NULL DEFAULT 'patient',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  patient_phone VARCHAR(30) NOT NULL,
  department VARCHAR(80) NOT NULL,
  doctor VARCHAR(120) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('Pending','Confirmed','Cancelled') NOT NULL DEFAULT 'Pending',
  active_slot VARCHAR(255) GENERATED ALWAYS AS (
    CASE WHEN status <> 'Cancelled'
      THEN CONCAT(doctor, '|', appointment_date, '|', appointment_time)
      ELSE NULL END
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_doctor_active_slot (active_slot),
  INDEX idx_appointments_user_date (user_id, appointment_date)
);
