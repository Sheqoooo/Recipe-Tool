export class AppError extends Error {
  usage?: import('./types.js').Usage;
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
