import { useState, useEffect } from 'react';

interface EmailValidationResult {
  email: string;
  setEmail: (value: string) => void;
  errors: string[];
  isValid: boolean;
  hasErrors: boolean;
}

export function useEmailValidation(initialValue: string = ''): EmailValidationResult {
  const [email, setEmailState] = useState(initialValue);
  const [errors, setErrors] = useState<string[]>([]);

  const validateEmail = (email: string): string[] => {
    const errors: string[] = [];

    if (!email.trim()) {
      errors.push('Email is required');
      return errors;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }

    if (email.length > 255) {
      errors.push('Email address is too long (max 255 characters)');
    }

    // Check for common typos
    const commonTypos = [
      '.con', '.cm', '.co', '.om', '.cok', '.cmo', '.ocm',
      '.gmal', '.gmial', '.gmail.con', '.gamil.com'
    ];

    if (commonTypos.some(typo => email.toLowerCase().includes(typo))) {
      errors.push('Possible typo in domain name');
    }

    // Check for spacing issues
    if (email.includes(' ') && email.trim().split(' ').length > 1) {
      errors.push('Email should not contain spaces');
    }

    return errors;
  };

  const handleEmailChange = (value: string) => {
    setEmailState(value);
    const validationErrors = validateEmail(value);
    setErrors(validationErrors);
  };

  useEffect(() => {
    // Re-validate when email changes
    const validationErrors = validateEmail(email);
    setErrors(validationErrors);
  }, [email]);

  const isValid = errors.length === 0 && email.trim() !== '';

  return {
    email,
    setEmail: handleEmailChange,
    errors,
    isValid,
    hasErrors: errors.length > 0
  };
}