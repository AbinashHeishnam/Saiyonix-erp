import { vi } from "vitest";
import request from "./helpers/supertest-lite";

vi.mock("supertest", () => ({
  default: request,
}));
