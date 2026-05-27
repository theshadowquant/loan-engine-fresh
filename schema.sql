-- ============================================================
-- LOAN MANAGEMENT & EMI TRACKING SYSTEM — CLEAN SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS loan_engine
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE loan_engine;

-- =========================
-- 1. USERS
-- =========================
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    pan_number VARCHAR(10) NOT NULL UNIQUE,
    aadhar_number VARCHAR(12),
    address TEXT,
    is_active TINYINT(1) DEFAULT 1,
    is_verified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================
-- 2. ROLES
-- =========================
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO roles (name, description) VALUES
('ADMIN','Full control'),
('USER','Basic user'),
('LOAN_OFFICER','Loan reviewer'),
('AUDITOR','Read only');

-- =========================
-- 3. USER_ROLES (FIXED)
-- =========================
CREATE TABLE user_roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    assigned_by BIGINT UNSIGNED NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT(1) DEFAULT 1,

    UNIQUE KEY uq_user_role (user_id, role_id),

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- 4. LOAN_APPLICATIONS
-- =========================
CREATE TABLE loan_applications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    requested_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(6,4) DEFAULT 12.0000,
    tenure_months SMALLINT UNSIGNED NOT NULL,
    purpose TEXT,
    status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED') DEFAULT 'PENDING',
    reviewed_by BIGINT UNSIGNED,
    reviewed_at TIMESTAMP NULL,
    rejection_reason TEXT,
    loan_id BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================
-- 5. LOANS
-- =========================
CREATE TABLE loans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    loan_reference VARCHAR(30) UNIQUE,
    principal_amount DECIMAL(15,2),
    interest_rate DECIMAL(6,4),
    tenure_months SMALLINT,
    emi_amount_at_origination DECIMAL(15,2),
    current_emi_amount DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    status ENUM('ACTIVE','CLOSED','DEFAULTED') DEFAULT 'ACTIVE',
    outstanding_principal DECIMAL(15,2),

    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================
-- 6. EMI_SCHEDULE
-- =========================
CREATE TABLE emi_schedule (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    loan_id BIGINT UNSIGNED,
    installment_number INT,
    due_date DATE,
    emi_amount DECIMAL(15,2),
    principal_component DECIMAL(15,2),
    interest_component DECIMAL(15,2),
    outstanding_balance DECIMAL(15,2),
    status ENUM('PENDING','PAID','OVERDUE') DEFAULT 'PENDING',

    FOREIGN KEY (loan_id) REFERENCES loans(id)
) ENGINE=InnoDB;

-- =========================
-- 7. PAYMENTS
-- =========================
CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    loan_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED,
    amount_paid DECIMAL(15,2),
    payment_mode VARCHAR(50),
    transaction_reference VARCHAR(100) UNIQUE,
    payment_status ENUM('SUCCESS','FAILED') DEFAULT 'SUCCESS',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================
-- 8. PENALTIES
-- =========================
CREATE TABLE penalties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    loan_id BIGINT UNSIGNED,
    emi_id BIGINT UNSIGNED,
    penalty_amount DECIMAL(15,2),
    status ENUM('PENDING','PAID') DEFAULT 'PENDING',

    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (emi_id) REFERENCES emi_schedule(id)
) ENGINE=InnoDB;

-- =========================
-- 9. NOTIFICATIONS
-- =========================
CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED,
    message TEXT,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;