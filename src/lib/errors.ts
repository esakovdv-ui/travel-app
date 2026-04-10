export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly expose = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DuplicateRegistrationError extends AppError {
  constructor() {
    super('An account with this email already exists.', 409);
    this.name = 'DuplicateRegistrationError';
  }
}

export class BookingConflictError extends AppError {
  constructor() {
    super('This package has limited availability right now. Please try another date.', 409);
    this.name = 'BookingConflictError';
  }
}
