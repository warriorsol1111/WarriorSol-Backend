import { Response } from "express";

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
}

interface FailureResponse {
  status: "error";
  statusCode: number;
  message: string;
}

function successResponse<T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T | null = null,
  pagination: Pagination | null = null,
  token: string | null = null
): void {
  const response: any = {
    status: "success",
    statusCode,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  if (pagination !== null) {
    response.pagination = pagination;
  }

  if (token !== null) {
    response.token = token;
  }

  res.status(statusCode).json(response);
}

function failureResponse(
  res: Response,
  statusCode: number,
  message: string
): void {
  const response: FailureResponse = {
    status: "error",
    statusCode,
    message,
  };

  res.status(statusCode).json(response);
}

export { successResponse, failureResponse };
