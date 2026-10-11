// Client, configuration and errors
export {
  ApiError,
  buildUrl,
  configureApi,
  DEFAULT_DOC_READER_URL,
  errorMessage,
  getApiConfig,
  HttpError,
  isAbortError,
  isHttpError,
  isUnauthorized,
  NetworkError,
  request,
  SchemaError,
  type ApiConfig,
  type ApiErrorKind,
  type RequestOptions,
} from './client';

// Schemas and types
export * from './schemas';

// Endpoints, one module per API area
export * from './modules/users';
export * from './modules/vehicles';
export * from './modules/insurance';
export * from './modules/roadworthiness';
export * from './modules/vehicleLicenses';
export * from './modules/insuranceCompanies';
export * from './modules/transactions';
export * from './modules/wallets';
export * from './modules/renewals';
export * from './modules/pricing';
export * from './modules/notificationPreferences';

// Document reader, payment stream, status maths and formatting
export * from './docReader';
export * from './sse';
export * from './status';
export * from './format';
export * from './plates';
export * from './jwt';
