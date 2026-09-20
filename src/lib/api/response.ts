import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "database_error"
  | "invalid_request"
  | "unauthorized";

type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return NextResponse.json(body, { status });
}
