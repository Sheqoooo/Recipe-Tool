export interface Env {
  DB?: D1Database; ASSETS: Fetcher;
  APP_ENV: 'local' | 'production' | 'preview'; AUTH_MODE: 'access' | 'local';
  APP_ORIGIN?: string; ACCESS_ISSUER?: string; ACCESS_AUD?: string;
  BOOTSTRAP_ADMIN_EMAILS?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string;
  MEDIA_UPLOAD_ENABLED?:string;
  OPENAI_VIDEO_MODEL?:string; OPENAI_AUDIO_MODEL?:string; VIDEO_MODEL_INPUT_USD_PER_MILLION?:string; VIDEO_MODEL_OUTPUT_USD_PER_MILLION?:string;
  MODEL_INPUT_USD_PER_MILLION?: string; MODEL_OUTPUT_USD_PER_MILLION?: string;
  RECIPE_ALLOWED_HOSTS?: string; MAX_PARALLEL_IMPORTS?: string; USER_IMPORTS_PER_MINUTE?: string;
  USER_IMPORTS_PER_DAY?: string; DAILY_BUDGET_MICROUSD?: string; MONTHLY_BUDGET_MICROUSD?: string;
}
