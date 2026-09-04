import { NextResponse } from 'next/server';
import { ApiErrorCode, formatApiError } from './errors';

export function apiSuccess(
  data: any,
  requestId: string,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return NextResponse.json(
    {
      requestId,
      data,
    },
    {
      status,
      headers: {
        'x-request-id': requestId,
        ...extraHeaders,
      },
    }
  );
}

export function apiErrorResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  status = 400,
  extraHeaders: Record<string, string> = {}
) {
  return NextResponse.json(formatApiError(code, message, requestId), {
    status,
    headers: {
      'x-request-id': requestId,
      ...extraHeaders,
    },
  });
}
