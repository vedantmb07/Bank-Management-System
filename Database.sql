-- ========================================================
-- Database Schema for Bank Management System
-- Matches the EER Diagram (Customers, Accounts, Transactions, Transfers)
-- ========================================================

CREATE DATABASE IF NOT EXISTS BankManagementDB;
USE BankManagementDB;

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS Accounts (
    account_number BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    account_type ENUM('SAVINGS', 'CHECKING', 'FIXED_DEPOSIT') NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'FROZEN', 'CLOSED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
) AUTO_INCREMENT = 1001;

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS Transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_number BIGINT NOT NULL,
    transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_number) REFERENCES Accounts(account_number) ON DELETE CASCADE
);

-- 4. Transfers Table
CREATE TABLE IF NOT EXISTS Transfers (
    transfer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_account BIGINT NOT NULL,
    receiver_account BIGINT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_account) REFERENCES Accounts(account_number) ON DELETE CASCADE,
    FOREIGN KEY (receiver_account) REFERENCES Accounts(account_number) ON DELETE CASCADE
);

-- Trigger: Automatically record transaction on account balance update
DELIMITER $$
DROP TRIGGER IF EXISTS after_account_update$$
CREATE TRIGGER after_account_update
AFTER UPDATE ON Accounts
FOR EACH ROW
BEGIN
    IF NEW.balance <> OLD.balance THEN
        INSERT INTO Transactions (account_number, transaction_type, amount, balance_after)
        VALUES (
            NEW.account_number, 
            IF(NEW.balance > OLD.balance, 'DEPOSIT', 'WITHDRAWAL'), 
            ABS(NEW.balance - OLD.balance), 
            NEW.balance
        );
    END IF;
END$$
DELIMITER ;

-- ========================================================
-- Initial Sample Data (if tables are empty)
-- ========================================================
INSERT IGNORE INTO Customers (customer_id, first_name, last_name, email, phone, address) VALUES
(1, 'Aarav', 'Sharma', 'aarav.sharma@example.com', '9820012345', 'Mumbai, Maharashtra'),
(2, 'Riya', 'Verma', 'riya.verma@example.com', '9820054321', 'Pune, Maharashtra'),
(3, 'Ananya', 'Deshmukh', 'ananya.d@example.com', '9820099999', 'Mumbai, Maharashtra');

INSERT IGNORE INTO Accounts (account_number, customer_id, account_type, balance, status) VALUES
(1001, 1, 'SAVINGS', 25000.00, 'ACTIVE'),
(1002, 2, 'CHECKING', 15000.00, 'ACTIVE'),
(1003, 3, 'SAVINGS', 50000.00, 'ACTIVE');