export interface AjvError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

export interface StandaloneValidator {
  (data: unknown): boolean;
  errors?: AjvError[] | null;
}

declare const validate: StandaloneValidator;
export default validate;
