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
    super('Аккаунт с таким email уже существует', 409);
    this.name = 'DuplicateRegistrationError';
  }
}

export class BookingConflictError extends AppError {
  constructor() {
    super('Недостаточно мест. Попробуйте другую дату или количество туристов', 409);
    this.name = 'BookingConflictError';
  }
}
